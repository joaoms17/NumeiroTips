/**
 * Cliente API-Football (api-sports.io) — stats reais de qualquer liga.
 * ===================================================================
 *
 * Free tier: 100 pedidos/DIA. Por isso:
 *  - tudo é LAZY (só busca quando carregas no jogo);
 *  - há CACHE em localStorage (ids de equipa ~7 dias; trends/h2h ~6h);
 *  - cada confronto custa ~5 pedidos (2 search + 2 últimos jogos + 1 h2h).
 *
 * Stats derivadas dos ÚLTIMOS N jogos (sem pedidos extra por jogo): forma,
 * golos marcados/sofridos, over 1.5/2.5%, ambas marcam%, clean sheet%.
 *
 * NOTA: a chave fica no browser (uso pessoal). Se a API bloquear por CORS,
 * passa-se a chamada por uma Edge Function (proxy) — ver README.
 */
import { env } from '../lib/env';

const BASE = 'https://v3.football.api-sports.io';

export interface LiveTeamTrends {
  team: string;
  teamId: number;
  played: number;
  form: Array<'W' | 'D' | 'L'>;
  gfAvg: number;
  gaAvg: number;
  over15Pct: number;
  over25Pct: number;
  bttsPct: number;
  cleanSheetPct: number;
}

export interface H2HSummary {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  avgGoals: number;
  results: string[]; // ex.: "2-1", "0-0"
}

export interface MatchupStats {
  home: LiveTeamTrends | null;
  away: LiveTeamTrends | null;
  h2h: H2HSummary | null;
  remaining: number | null; // pedidos restantes hoje
}

export function hasApiFootballKey(): boolean {
  // Em produção o proxy /api/football pode ter a chave no servidor mesmo sem
  // VITE_; por isso mostramos a opção e, se faltar a chave, o proxy avisa.
  return !!env.apiFootballKey || import.meta.env.PROD;
}

// ---- cache helpers ----
const TEAM_TTL = 7 * 24 * 3600_000;
const STAT_TTL = 6 * 3600_000;

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { exp, v } = JSON.parse(raw) as { exp: number; v: T };
    if (Date.now() > exp) return null;
    return v;
  } catch {
    return null;
  }
}
function cacheSet<T>(key: string, v: T, ttl: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ exp: Date.now() + ttl, v }));
  } catch {
    /* ignore */
  }
}

let lastRemaining: number | null = null;

// Em produção (Vercel) usamos o proxy /api/football (mesma origem → sem CORS,
// chave no servidor). Em dev fazemos chamada direta com a chave VITE_.
const USE_PROXY = import.meta.env.PROD;

async function af<T>(path: string): Promise<{ data: T[]; remaining: number | null }> {
  const url = USE_PROXY ? `/api/football?path=${encodeURIComponent(path)}` : `${BASE}${path}`;
  const headers: Record<string, string> = USE_PROXY
    ? {}
    : { 'x-apisports-key': env.apiFootballKey ?? '' };
  const res = await fetch(url, { headers });
  const remaining = num(res.headers.get('x-ratelimit-requests-remaining'));
  if (remaining != null) lastRemaining = remaining;
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const json = (await res.json()) as { response?: T[]; errors?: unknown };
  return { data: json.response ?? [], remaining };
}

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Resolve o id de uma equipa pelo nome (cache longo). */
async function teamId(name: string): Promise<number | null> {
  const key = `af:team:${name.toLowerCase()}`;
  const cached = cacheGet<number>(key);
  if (cached != null) return cached;
  const { data } = await af<{ team: { id: number; name: string } }>(
    `/teams?search=${encodeURIComponent(name)}`,
  );
  const id = data[0]?.team?.id ?? null;
  if (id != null) cacheSet(key, id, TEAM_TTL);
  return id;
}

interface AFFixture {
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  fixture: { status: { short: string } };
}

const FINISHED = new Set(['FT', 'AET', 'PEN']);

function trendsFrom(name: string, id: number, fixtures: AFFixture[]): LiveTeamTrends {
  const done = fixtures.filter((f) => FINISHED.has(f.fixture.status.short));
  const n = done.length || 1;
  let gf = 0,
    ga = 0,
    over15 = 0,
    over25 = 0,
    btts = 0,
    cs = 0;
  const form: Array<'W' | 'D' | 'L'> = [];
  for (const f of done) {
    const isHome = f.teams.home.id === id;
    const my = (isHome ? f.goals.home : f.goals.away) ?? 0;
    const opp = (isHome ? f.goals.away : f.goals.home) ?? 0;
    gf += my;
    ga += opp;
    if (my + opp > 1.5) over15++;
    if (my + opp > 2.5) over25++;
    if (my > 0 && opp > 0) btts++;
    if (opp === 0) cs++;
    form.push(my > opp ? 'W' : my < opp ? 'L' : 'D');
  }
  return {
    team: name,
    teamId: id,
    played: done.length,
    form,
    gfAvg: round2(gf / n),
    gaAvg: round2(ga / n),
    over15Pct: round3(over15 / n),
    over25Pct: round3(over25 / n),
    bttsPct: round3(btts / n),
    cleanSheetPct: round3(cs / n),
  };
}

async function teamTrends(name: string, n = 10): Promise<LiveTeamTrends | null> {
  const id = await teamId(name);
  if (id == null) return null;
  const key = `af:trends:${id}:${n}`;
  const cached = cacheGet<LiveTeamTrends>(key);
  if (cached) return cached;
  const { data } = await af<AFFixture>(`/fixtures?team=${id}&last=${n}`);
  const t = trendsFrom(name, id, data);
  cacheSet(key, t, STAT_TTL);
  return t;
}

async function h2h(id1: number, id2: number, n = 10): Promise<H2HSummary | null> {
  const key = `af:h2h:${id1}-${id2}`;
  const cached = cacheGet<H2HSummary>(key);
  if (cached) return cached;
  const { data } = await af<AFFixture>(`/fixtures/headtohead?h2h=${id1}-${id2}&last=${n}`);
  const done = data.filter((f) => FINISHED.has(f.fixture.status.short));
  let hw = 0,
    d = 0,
    aw = 0,
    g = 0;
  const results: string[] = [];
  for (const f of done) {
    const hs = f.goals.home ?? 0;
    const as = f.goals.away ?? 0;
    g += hs + as;
    if (hs > as) hw++;
    else if (hs < as) aw++;
    else d++;
    results.push(`${hs}-${as}`);
  }
  const sum: H2HSummary = {
    played: done.length,
    homeWins: hw,
    draws: d,
    awayWins: aw,
    avgGoals: done.length ? round2(g / done.length) : 0,
    results,
  };
  cacheSet(key, sum, STAT_TTL);
  return sum;
}

/** Busca stats das duas equipas + h2h de um confronto. Lazy + cache. */
export async function getMatchupStats(home: string, away: string): Promise<MatchupStats> {
  const [h, a] = await Promise.all([teamTrends(home), teamTrends(away)]);
  let head: H2HSummary | null = null;
  if (h && a) {
    try {
      head = await h2h(h.teamId, a.teamId);
    } catch {
      head = null;
    }
  }
  return { home: h, away: a, h2h: head, remaining: lastRemaining };
}
