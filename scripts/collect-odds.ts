/**
 * Coletor de odds (agendado) — corre no GitHub Actions, NÃO no browser.
 * =====================================================================
 *
 * Vai buscar as odds ao The Odds API UMA vez por execução (horário fixo no
 * workflow), normaliza para MarketSnapshot[] e escreve `snapshot.json`. O
 * workflow publica esse ficheiro numa branch de cache (`odds-cache`), e a app
 * passa a LER daí — por isso o consumo de créditos deixa de depender de quantas
 * vezes abres/atualizas a app: é fixo e previsível (1 execução = nº_ligas ×
 * nº_mercados créditos).
 *
 * A chave (THE_ODDS_API_KEY) vive nos *secrets* do GitHub, nunca no cliente.
 *
 * Uso local: `THE_ODDS_API_KEY=... npm run collect:odds`
 */
import { writeFileSync } from 'node:fs';
import { normalizeTheOddsApi, type TOAEvent } from '../src/data/theOddsApiNormalize';
import type { MarketSnapshot } from '../src/lib/types';

const KEY = process.env.THE_ODDS_API_KEY;
const BASE = process.env.THE_ODDS_API_BASE_URL ?? 'https://api.the-odds-api.com/v4';
const REGIONS = process.env.THE_ODDS_API_REGIONS ?? 'eu';
// Menos mercados = menos créditos por execução. Default barato mas útil.
const MARKETS = process.env.THE_ODDS_API_MARKETS ?? 'h2h,totals';
const BOOKMAKERS = process.env.THE_ODDS_API_BOOKMAKERS ?? 'pinnacle,betfair_ex_eu,betclic,onexbet';
const LEAGUES = (
  process.env.THE_ODDS_API_SPORTS ??
  'soccer_fifa_world_cup,soccer_brazil_campeonato,soccer_conmebol_copa_libertadores,soccer_usa_mls,soccer_sweden_allsvenskan,soccer_norway_eliteserien'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const OUT = process.env.SNAPSHOT_OUT ?? 'snapshot.json';

async function main() {
  if (!KEY) {
    console.error('[collect-odds] falta THE_ODDS_API_KEY');
    process.exit(1);
  }

  const snapshots: MarketSnapshot[] = [];
  let lastRemaining: string | null = null;

  for (const sk of LEAGUES) {
    const params = new URLSearchParams({
      regions: REGIONS,
      markets: MARKETS,
      oddsFormat: 'decimal',
      bookmakers: BOOKMAKERS,
      apiKey: KEY,
    });
    const url = `${BASE}/sports/${sk}/odds?${params.toString()}`;
    try {
      const res = await fetch(url);
      lastRemaining = res.headers.get('x-requests-remaining') ?? lastRemaining;
      if (!res.ok) {
        console.warn(`[collect-odds] ${sk} HTTP ${res.status}`);
        continue;
      }
      const events = (await res.json()) as TOAEvent[];
      const snaps = normalizeTheOddsApi(events);
      snapshots.push(...snaps);
      console.log(`[collect-odds] ${sk}: ${events.length} jogos → ${snaps.length} mercados`);
    } catch (e) {
      console.warn(`[collect-odds] ${sk} falhou`, e);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'the-odds-api',
    leagues: LEAGUES,
    markets: MARKETS,
    count: snapshots.length,
    snapshots,
  };
  writeFileSync(OUT, JSON.stringify(payload));
  console.log(
    `[collect-odds] escrito ${OUT}: ${snapshots.length} mercados` +
      (lastRemaining != null ? ` · ${lastRemaining} créditos restantes` : ''),
  );
}

main().catch((e) => {
  console.error('[collect-odds] erro fatal', e);
  process.exit(1);
});
