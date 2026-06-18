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
import {
  normalizeApiFootballOdds,
  type AFFixtureMeta,
  type AFOddsEntry,
} from '../src/data/apiFootballOddsNormalize';
import type { MarketSnapshot } from '../src/lib/types';

/** Fonte: 'theoddsapi' (500/mês) ou 'apifootball' (100/DIA, reseta diário). */
const SOURCE = (process.env.COLLECT_SOURCE ?? 'theoddsapi').toLowerCase();

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

// ---- API-Football (quota DIÁRIA: 100/dia) -----------------------------------
const AF_KEY = process.env.API_FOOTBALL_KEY;
const AF_BASE = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';
// Ligas API-Football no formato `leagueId:season` (ex.: Mundial = 1:2026).
const AF_LEAGUES = (process.env.AF_LEAGUES ?? '1:2026')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// Protege a quota: nº máx. de jogos a pedir odds por execução (1 pedido cada).
const AF_MAX_FIXTURES = Number(process.env.AF_MAX_FIXTURES ?? '25');

interface AFFixtureResp {
  fixture: { id: number; date: string };
  league: { name: string };
  teams: { home: { name: string }; away: { name: string } };
}

async function afGet<T>(path: string): Promise<{ data: T[]; remaining: string | null }> {
  const res = await fetch(`${AF_BASE}${path}`, { headers: { 'x-apisports-key': AF_KEY ?? '' } });
  const remaining = res.headers.get('x-ratelimit-requests-remaining');
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status} em ${path}`);
  const json = (await res.json()) as { response?: T[]; errors?: unknown };
  const errs = json.errors;
  if (errs && typeof errs === 'object' && Object.values(errs as Record<string, string>).some(Boolean)) {
    throw new Error(Object.values(errs as Record<string, string>).filter(Boolean).join('; '));
  }
  return { data: json.response ?? [], remaining };
}

async function collectApiFootball(): Promise<MarketSnapshot[]> {
  if (!AF_KEY) {
    console.error('[collect-odds] falta API_FOOTBALL_KEY');
    process.exit(1);
  }
  // 1) próximos jogos por liga → meta (id, equipas, início)
  const metas: AFFixtureMeta[] = [];
  for (const ls of AF_LEAGUES) {
    const [league, season] = ls.split(':');
    try {
      const { data } = await afGet<AFFixtureResp>(
        `/fixtures?league=${league}&season=${season}&next=${AF_MAX_FIXTURES}`,
      );
      for (const f of data) {
        metas.push({
          id: String(f.fixture.id),
          home: f.teams.home.name,
          away: f.teams.away.name,
          league: f.league.name,
          startsAt: f.fixture.date,
        });
      }
      console.log(`[collect-odds] liga ${ls}: ${data.length} jogos`);
    } catch (e) {
      console.warn(`[collect-odds] fixtures ${ls} falhou`, e);
    }
  }

  // 2) odds por jogo (1 pedido cada; respeita o limite diário)
  const snapshots: MarketSnapshot[] = [];
  let remaining: string | null = null;
  for (const meta of metas.slice(0, AF_MAX_FIXTURES)) {
    try {
      const { data, remaining: r } = await afGet<AFOddsEntry>(`/odds?fixture=${meta.id}`);
      remaining = r ?? remaining;
      if (data[0]) {
        const snaps = normalizeApiFootballOdds(meta, data[0]);
        snapshots.push(...snaps);
      }
    } catch (e) {
      console.warn(`[collect-odds] odds do jogo ${meta.id} falhou`, e);
    }
  }
  console.log(
    `[collect-odds] API-Football: ${snapshots.length} mercados` +
      (remaining != null ? ` · ${remaining} pedidos restantes hoje` : ''),
  );
  return snapshots;
}

// ---- The Odds API (quota MENSAL: 500/mês) ------------------------------------
async function collectTheOddsApi(): Promise<MarketSnapshot[]> {
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
    try {
      const res = await fetch(`${BASE}/sports/${sk}/odds?${params.toString()}`);
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
  console.log(
    `[collect-odds] The Odds API: ${snapshots.length} mercados` +
      (lastRemaining != null ? ` · ${lastRemaining} créditos restantes` : ''),
  );
  return snapshots;
}

async function main() {
  const snapshots =
    SOURCE === 'apifootball' ? await collectApiFootball() : await collectTheOddsApi();

  const payload = {
    generatedAt: new Date().toISOString(),
    source: SOURCE === 'apifootball' ? 'api-football' : 'the-odds-api',
    count: snapshots.length,
    snapshots,
  };
  writeFileSync(OUT, JSON.stringify(payload));
  console.log(`[collect-odds] escrito ${OUT}: ${snapshots.length} mercados (fonte: ${SOURCE})`);
}

main().catch((e) => {
  console.error('[collect-odds] erro fatal', e);
  process.exit(1);
});
