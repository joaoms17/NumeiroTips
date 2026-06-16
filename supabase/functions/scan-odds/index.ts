/**
 * Edge Function: scan-odds
 * ========================
 *
 * O coração server-side do motor. Corre em ciclo curto (Vercel Cron a cada
 * poucos segundos, ou agendamento do Supabase) e:
 *
 *   1. Vai buscar odds à OddsPapi (Pinnacle, Betfair, Betclic, 1xBet).
 *   2. De-vig (Shin) da régua sharp → prob./odd justas por seleção.
 *   3. Calcula o edge de Betclic e 1xBet vs o justo.
 *   4. Faz upsert das value bets ≥ limiar em `value_bets` (Realtime → frontend).
 *   5. Grava odds em `odds_snapshots` (histórico/CLV) e o justo em `fair_prices`.
 *
 * A chave OddsPapi vive AQUI (servidor), nunca no browser. O frontend só ouve
 * `value_bets` via Supabase Realtime.
 *
 * Deploy: supabase functions deploy scan-odds
 * Segredos: supabase secrets set ODDSPAPI_API_KEY=... etc.
 */
// @ts-nocheck Deno runtime (tipos resolvidos no deploy)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { devig, expectedValue, kellyStake } from "../_shared/math.ts";

const EDGE_THRESHOLD = Number(Deno.env.get("ENGINE_EDGE_THRESHOLD") ?? "0.02");
const DEVIG_METHOD = (Deno.env.get("ENGINE_DEVIG_METHOD") ?? "shin") as "shin" | "proportional";
const KELLY_FRACTION = Number(Deno.env.get("ENGINE_KELLY_FRACTION") ?? "0.25");
const SHARP_SOURCE = (Deno.env.get("ENGINE_SHARP_SOURCE") ?? "pinnacle");
const STAKE_CAP = Number(Deno.env.get("ENGINE_STAKE_CAP") ?? "0.05");
const DEFAULT_BANKROLL = Number(Deno.env.get("ENGINE_BANKROLL") ?? "1000");

const TARGET_BOOKS = ["betclic", "1xbet"];

interface NormalizedMarket {
  eventId: string;
  league: string;
  home: string;
  away: string;
  startsAt: string;
  marketId: string; // base id do mercado (sem seleção)
  marketType: string;
  line: number | null;
  selections: Array<{ id: string; label: string }>;
  // odds[book][selectionId] = odd
  odds: Record<string, Record<string, number>>;
}

async function fetchOddsPapi(): Promise<NormalizedMarket[]> {
  const key = Deno.env.get("ODDSPAPI_API_KEY");
  const base = Deno.env.get("ODDSPAPI_BASE_URL") ?? "https://api.oddspapi.io/v1";
  if (!key) {
    console.warn("[scan-odds] sem ODDSPAPI_API_KEY — nada a fazer");
    return [];
  }
  const res = await fetch(`${base}/odds?sport=football`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`OddsPapi HTTP ${res.status}`);
  const raw = await res.json();
  return normalize(raw);
}

/**
 * Mapeia a resposta OddsPapi → NormalizedMarket[].
 * Ajusta este mapeamento ao schema real do teu plano OddsPapi.
 */
function normalize(_raw: unknown): NormalizedMarket[] {
  // TODO: implementar com o schema real da OddsPapi.
  return [];
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const markets = await fetchOddsPapi();
    const now = new Date().toISOString();
    const valueBets: any[] = [];

    for (const m of markets) {
      const sharp = m.odds[SHARP_SOURCE];
      if (!sharp) continue;

      const oddsVec = m.selections.map((s) => sharp[s.id]);
      if (oddsVec.some((o) => !(o > 1))) continue; // sharp incompleta

      const fair = devig(oddsVec, DEVIG_METHOD);

      for (let i = 0; i < m.selections.length; i++) {
        const sel = m.selections[i];
        const f = fair[i];

        const books = [];
        for (const book of TARGET_BOOKS) {
          const o = m.odds[book]?.[sel.id];
          if (!(o > 1)) continue;
          const edge = expectedValue(f.prob, o);
          books.push({ book, odd: o, edge, isValue: edge >= EDGE_THRESHOLD });
        }
        if (!books.some((b) => b.isValue)) continue;

        // melhor odd entre as +EV (line shopping)
        const valueOnes = books.filter((b) => b.isValue);
        const best = valueOnes.reduce((a, b) => (b.odd > a.odd ? b : a), valueOnes[0]);
        const k = kellyStake(f.prob, best.odd, KELLY_FRACTION, DEFAULT_BANKROLL, STAKE_CAP);

        valueBets.push({
          id: sel.id,
          market_id: sel.id,
          book_id: best.book,
          odd_casa: best.odd,
          odd_justa: f.fairOdd,
          prob_justa: f.prob,
          edge: best.edge,
          kelly: k.fraction,
          stake: k.stake,
          estado: "ativo",
          books: books.sort((a, b) => b.edge - a.edge),
          detetado_em: now,
          atualizado_em: now,
        });
      }
    }

    if (valueBets.length > 0) {
      // upsert por id estável → preserva detetado_em via trigger/merge no cliente
      const { error } = await supabase
        .from("value_bets")
        .upsert(valueBets, { onConflict: "id", ignoreDuplicates: false });
      if (error) throw error;
    }

    return Response.json({ ok: true, scanned: markets.length, valueBets: valueBets.length });
  } catch (e) {
    console.error("[scan-odds]", e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
