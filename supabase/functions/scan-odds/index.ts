/**
 * Edge Function: scan-odds
 * ========================
 *
 * O coração server-side do motor. Corre em ciclo curto (Vercel Cron / Supabase
 * schedule) e:
 *
 *   1. Vai buscar fixtures + odds à OddsPapi (Pinnacle, Betfair, Betclic, 1xBet).
 *   2. Normaliza (ver _shared/oddspapi.ts) → snapshots por mercado.
 *   3. De-vig (Shin) da régua sharp → prob./odd justas por seleção.
 *   4. Calcula o edge de Betclic e 1xBet vs o justo.
 *   5. Upsert das value bets ≥ limiar em `value_bets` (Realtime → frontend) e
 *      grava odds em `odds_snapshots` (histórico/CLV).
 *
 * A chave OddsPapi vive AQUI (servidor), nunca no browser.
 *
 * Deploy: supabase functions deploy scan-odds
 * Segredos: supabase secrets set ODDSPAPI_API_KEY=... etc.
 */
// @ts-nocheck Deno runtime (tipos resolvidos no deploy)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { devig, expectedValue, kellyStake } from "../_shared/math.ts";
import { normalizeFixtureOdds, type Snapshot } from "../_shared/oddspapi.ts";
import { normalizeTheOddsApiEvent } from "../_shared/theoddsapi.ts";

// Fonte de dados: 'theoddsapi' (grátis, cobre as 4 casas) ou 'oddspapi' (pago).
const DATA_SOURCE = (Deno.env.get("ENGINE_DATA_SOURCE") ?? "theoddsapi").toLowerCase();

const EDGE_THRESHOLD = Number(Deno.env.get("ENGINE_EDGE_THRESHOLD") ?? "0.02");
const DEVIG_METHOD = (Deno.env.get("ENGINE_DEVIG_METHOD") ?? "shin") as "shin" | "proportional";
const KELLY_FRACTION = Number(Deno.env.get("ENGINE_KELLY_FRACTION") ?? "0.25");
const SHARP_SOURCE = Deno.env.get("ENGINE_SHARP_SOURCE") ?? "pinnacle";
const STAKE_CAP = Number(Deno.env.get("ENGINE_STAKE_CAP") ?? "0.05");
const DEFAULT_BANKROLL = Number(Deno.env.get("ENGINE_BANKROLL") ?? "1000");
const MAX_FIXTURES = Number(Deno.env.get("ENGINE_MAX_FIXTURES") ?? "50");

const TARGET_BOOKS = ["betclic", "1xbet"];

/** Dispatcher: escolhe a fonte de dados configurada. */
async function fetchSnapshots(): Promise<Snapshot[]> {
  if (DATA_SOURCE === "oddspapi") return fetchOddsPapi();
  return fetchTheOddsApi();
}

// ---- The Odds API (grátis, cobre Pinnacle/Betfair/Betclic/1xBet) ------------
async function fetchTheOddsApi(): Promise<Snapshot[]> {
  const key = Deno.env.get("THE_ODDS_API_KEY");
  if (!key) {
    console.warn("[scan-odds] sem THE_ODDS_API_KEY — nada a fazer");
    return [];
  }
  const base = Deno.env.get("THE_ODDS_API_BASE_URL") ?? "https://api.the-odds-api.com/v4";
  const regions = Deno.env.get("THE_ODDS_API_REGIONS") ?? "eu";
  const markets = Deno.env.get("THE_ODDS_API_MARKETS") ?? "h2h,totals,spreads";
  const bookmakers = Deno.env.get("THE_ODDS_API_BOOKMAKERS") ?? "pinnacle,betfair_ex_eu,betclic,onexbet";
  const leagues = (Deno.env.get("THE_ODDS_API_SPORTS") ??
    "soccer_fifa_world_cup,soccer_brazil_campeonato,soccer_conmebol_copa_libertadores,soccer_usa_mls,soccer_sweden_allsvenskan,soccer_norway_eliteserien").split(",");

  const all: Snapshot[] = [];
  for (const sk of leagues) {
    const params = new URLSearchParams({ regions, markets, oddsFormat: "decimal", bookmakers, apiKey: key });
    try {
      const res = await fetch(`${base}/sports/${sk.trim()}/odds?${params.toString()}`);
      const remaining = res.headers.get("x-requests-remaining");
      if (remaining != null) console.log(`[scan-odds] ${sk}: ${remaining} créditos restantes`);
      if (!res.ok) {
        console.warn(`[scan-odds] ${sk} HTTP ${res.status}`);
        continue;
      }
      const events = await res.json();
      for (const ev of events) all.push(...normalizeTheOddsApiEvent(ev));
    } catch (e) {
      console.warn("[scan-odds] liga falhou", sk, e);
    }
  }
  return all;
}

// ---- OddsPapi (pago, WebSocket no Pro) --------------------------------------
async function oddsPapiGet<T>(path: string): Promise<T> {
  const key = Deno.env.get("ODDSPAPI_API_KEY");
  const base = Deno.env.get("ODDSPAPI_BASE_URL") ?? "https://api.oddspapi.io/v1";
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`OddsPapi HTTP ${res.status} em ${path}`);
  return (await res.json()) as T;
}

async function fetchOddsPapi(): Promise<Snapshot[]> {
  if (!Deno.env.get("ODDSPAPI_API_KEY")) {
    console.warn("[scan-odds] sem ODDSPAPI_API_KEY — nada a fazer");
    return [];
  }
  const sport = Deno.env.get("ENGINE_SPORT") ?? "soccer";
  const fixturesResp = await oddsPapiGet<{ fixtures?: any[] }>(
    `/fixtures?sport=${sport}&status=prematch`,
  );
  const fixtures = (fixturesResp.fixtures ?? []).slice(0, MAX_FIXTURES);

  const all: Snapshot[] = [];
  for (const fx of fixtures) {
    try {
      const odds = await oddsPapiGet<any>(`/odds?fixtureId=${fx.id}`);
      all.push(...normalizeFixtureOdds(fx, odds));
    } catch (e) {
      console.warn("[scan-odds] odds do fixture falhou", fx.id, e);
    }
  }
  return all;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const snapshots = await fetchSnapshots();
    const now = new Date().toISOString();
    const valueBets: any[] = [];
    const oddsRows: any[] = [];
    const eventRows = new Map<string, any>();
    const marketRows = new Map<string, any>();

    for (const snap of snapshots) {
      const sharp = snap.odds[SHARP_SOURCE];
      if (!sharp) continue;

      const oddsVec = snap.selections.map((s) => sharp[s.id]);
      if (oddsVec.some((o) => !(o > 1))) continue; // sharp incompleta

      const fair = devig(oddsVec, DEVIG_METHOD);

      eventRows.set(snap.eventId, {
        id: snap.eventId, desporto: "football", liga: snap.league,
        casa: snap.home, fora: snap.away, inicio: snap.startsAt,
      });

      for (let i = 0; i < snap.selections.length; i++) {
        const sel = snap.selections[i];
        const f = fair[i];

        marketRows.set(sel.id, {
          id: sel.id, event_id: snap.eventId, tipo: sel.market,
          linha: sel.line, selecao: sel.label,
        });

        // grava odds de todas as casas (histórico/CLV)
        for (const [book, byId] of Object.entries<any>(snap.odds)) {
          const o = byId[sel.id];
          if (o > 1) {
            oddsRows.push({
              market_id: sel.id, bookmaker_id: book, odd: o,
              volume: snap.volumes?.[book]?.[sel.id] ?? null, captado_em: now,
            });
          }
        }

        const books = [];
        for (const book of TARGET_BOOKS) {
          const o = snap.odds[book]?.[sel.id];
          if (!(o > 1)) continue;
          const edge = expectedValue(f.prob, o);
          books.push({ book, odd: o, edge, isValue: edge >= EDGE_THRESHOLD });
        }
        if (!books.some((b) => b.isValue)) continue;

        const valueOnes = books.filter((b) => b.isValue);
        const best = valueOnes.reduce((a, b) => (b.odd > a.odd ? b : a), valueOnes[0]);
        const k = kellyStake(f.prob, best.odd, KELLY_FRACTION, DEFAULT_BANKROLL, STAKE_CAP);

        valueBets.push({
          id: sel.id, market_id: sel.id, book_id: best.book,
          odd_casa: best.odd, odd_justa: f.fairOdd, prob_justa: f.prob,
          edge: best.edge, kelly: k.fraction, stake: k.stake, estado: "ativo",
          books: books.sort((a, b) => b.edge - a.edge),
          meta: {
            league: snap.league, home: snap.home, away: snap.away,
            startsAt: snap.startsAt, market: sel.market, line: sel.line,
            selection_label: sel.label, fair_method: DEVIG_METHOD, sharp_source: SHARP_SOURCE,
          },
          detetado_em: now, atualizado_em: now,
        });
      }
    }

    // persiste (ordem respeita as FKs)
    if (eventRows.size) await supabase.from("events").upsert([...eventRows.values()], { onConflict: "id" });
    if (marketRows.size) await supabase.from("markets").upsert([...marketRows.values()], { onConflict: "id" });
    if (oddsRows.length) await supabase.from("odds_snapshots").insert(oddsRows);
    if (valueBets.length) {
      const { error } = await supabase.from("value_bets").upsert(valueBets, { onConflict: "id" });
      if (error) throw error;
    }
    // marca como expiradas as value bets que já não aparecem
    const activeIds = valueBets.map((v) => v.id);
    if (activeIds.length) {
      await supabase.from("value_bets").update({ estado: "expirado" })
        .eq("estado", "ativo").not("id", "in", `(${activeIds.map((s) => `"${s}"`).join(",")})`);
    }

    return Response.json({ ok: true, snapshots: snapshots.length, valueBets: valueBets.length });
  } catch (e) {
    console.error("[scan-odds]", e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
