/**
 * Cliente SofaScore (via proxy /api/sofascore) — jogos, ONZES e RATINGS ao vivo
 * do Mundial 2026. Fonte gratuita que cobre a época atual e dá nota por jogador.
 *
 * Estratégia (poupar pedidos / Cloudflare):
 *  - 1 pedido por dia da janela (hoje-2 .. hoje+4) para os jogos do Mundial;
 *  - lineups/ratings só para jogos AO VIVO ou TERMINADOS (os que têm nota);
 *  - cache curto (30s) porque ao vivo muda depressa.
 * Tudo best-effort: qualquer falha → devolve o que tiver (ou nada → fallback).
 */
import type { Footballer, Match, Pos } from './types';
import { teamFor, squadFor } from './liveFixtures';

const CACHE_KEY = 'ss:wc2026:v1';
const FIFA_WC_UT_ID = 16; // unique-tournament "FIFA World Cup" no SofaScore

interface CacheEntry { exp: number; matches: Match[] }

function cacheLoad(): Match[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw) as CacheEntry;
    return Date.now() < e.exp ? e.matches : null;
  } catch { return null; }
}
function cacheSave(matches: Match[]) {
  const live = matches.some((m) => m.status === 'live');
  const ttl = live ? 30_000 : 5 * 60_000;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ exp: Date.now() + ttl, matches })); }
  catch { /* ignore */ }
}
export function clearSofascoreCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

async function ss<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/sofascore?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

// ---- tipos (parciais) da API SofaScore ----
interface SsTeam { name: string }
interface SsEvent {
  id: number;
  tournament?: { uniqueTournament?: { id?: number } };
  status?: { type?: string; description?: string };
  homeTeam: SsTeam; awayTeam: SsTeam;
  homeScore?: { current?: number }; awayScore?: { current?: number };
  startTimestamp: number; // segundos
  roundInfo?: { name?: string; round?: number };
}
interface SsPlayer {
  player?: { name?: string; jerseyNumber?: string; position?: string };
  position?: string;
  substitute?: boolean;
  statistics?: { rating?: number };
}
interface SsLineups {
  confirmed?: boolean;
  home?: { players?: SsPlayer[] };
  away?: { players?: SsPlayer[] };
}

function dateStr(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function statusOf(ev: SsEvent): Match['status'] {
  const t = ev.status?.type;
  if (t === 'finished') return 'finished';
  if (t === 'inprogress') return 'live';
  return 'upcoming';
}

function liveMinute(ev: SsEvent): number | undefined {
  if (statusOf(ev) !== 'live') return undefined;
  const mins = Math.floor((Date.now() / 1000 - ev.startTimestamp) / 60);
  if (!Number.isFinite(mins) || mins < 0) return undefined;
  return Math.min(mins, 120);
}

function posFrom(p?: string): Pos {
  switch ((p ?? '').toUpperCase()) {
    case 'G': return 'GR';
    case 'D': return 'DEF';
    case 'M': return 'MED';
    case 'F': return 'AVA';
    default: return 'MED';
  }
}

/** Constrói lineup + ratings de uma equipa a partir dos jogadores do SofaScore. */
function buildSide(code: string, players: SsPlayer[]): { squad: Footballer[]; ratings: Record<string, number> } {
  const squad: Footballer[] = [];
  const ratings: Record<string, number> = {};
  const seen = new Set<number>();
  players.forEach((p, i) => {
    const name = p.player?.name;
    if (!name) return;
    let num = Number(p.player?.jerseyNumber);
    if (!Number.isFinite(num) || seen.has(num)) num = 100 + i; // garante id único
    seen.add(num);
    const id = `${code}-${num}`;
    squad.push({ id, name, team: code, pos: posFrom(p.position ?? p.player?.position), number: num });
    const r = p.statistics?.rating;
    if (typeof r === 'number' && r > 0) ratings[id] = Math.round(r * 10) / 10;
  });
  return { squad, ratings };
}

async function enrich(ev: SsEvent, m: Match): Promise<Match> {
  const lu = await ss<SsLineups>(`/event/${ev.id}/lineups`);
  if (!lu) return m; // sem lineups → fica com plantel curado
  const home = lu.home?.players ?? [];
  const away = lu.away?.players ?? [];
  if (home.length === 0 && away.length === 0) return m;
  const h = buildSide(m.home.code, home);
  const a = buildSide(m.away.code, away);
  const ratings = { ...h.ratings, ...a.ratings };
  return {
    ...m,
    lineupConfirmed: !!lu.confirmed,
    lineup: {
      home: h.squad.length ? h.squad : m.lineup.home,
      away: a.squad.length ? a.squad : m.lineup.away,
    },
    ratings: Object.keys(ratings).length ? ratings : m.ratings,
  };
}

function toMatch(ev: SsEvent): Match {
  const home = teamFor(ev.homeTeam.name);
  const away = teamFor(ev.awayTeam.name);
  const status = statusOf(ev);
  return {
    id: `ss-${ev.id}`,
    day: new Date(ev.startTimestamp * 1000).toISOString().slice(0, 10),
    kickoff: new Date(ev.startTimestamp * 1000).toISOString(),
    stage: ev.roundInfo?.name ?? (ev.roundInfo?.round ? `Jornada ${ev.roundInfo.round}` : 'Mundial'),
    home, away, status,
    minute: liveMinute(ev),
    homeGoals: ev.homeScore?.current,
    awayGoals: ev.awayScore?.current,
    lineup: { home: squadFor(home.code), away: squadFor(away.code) },
    source: 'sofascore',
  };
}

/** Vai buscar os jogos do Mundial 2026 ao SofaScore (com onzes/ratings). */
export async function fetchWorldCupMatches(): Promise<Match[]> {
  const cached = cacheLoad();
  if (cached) return cached;

  // janela de dias: hoje-2 .. hoje+4
  const offsets = [-2, -1, 0, 1, 2, 3, 4];
  const days = await Promise.all(
    offsets.map((o) => ss<{ events?: SsEvent[] }>(`/sport/football/scheduled-events/${dateStr(o)}`)),
  );

  const byId = new Map<number, SsEvent>();
  for (const d of days) {
    for (const ev of d?.events ?? []) {
      if (ev.tournament?.uniqueTournament?.id === FIFA_WC_UT_ID) byId.set(ev.id, ev);
    }
  }
  const events = [...byId.values()];
  if (events.length === 0) return []; // nada (bloqueado/sem dados) → fallback

  let matches = events.map(toMatch);

  // enriquecer (onze + ratings) só os que têm nota: ao vivo e terminados
  const toEnrich = events.filter((e) => statusOf(e) !== 'upcoming').slice(0, 16);
  const enriched = await Promise.allSettled(
    toEnrich.map((e) => enrich(e, matches.find((m) => m.id === `ss-${e.id}`)!)),
  );
  const enrichedById = new Map<string, Match>();
  enriched.forEach((r) => { if (r.status === 'fulfilled') enrichedById.set(r.value.id, r.value); });
  matches = matches.map((m) => enrichedById.get(m.id) ?? m);

  if (matches.length > 0) cacheSave(matches);
  return matches;
}
