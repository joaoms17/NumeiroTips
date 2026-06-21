/**
 * Sincronização online (Supabase) do RATING ROYALE.
 * =================================================
 * Quando VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY estão definidos, os palpites
 * e os spins são partilhados entre os 4 (cada um no seu telemóvel), com
 * atualização em tempo real. Sem essas chaves, a app corre local (mock).
 *
 * Tabelas (ver supabase/ratingroyale.sql): rr_picks, rr_spins.
 */
import { getSupabase } from '../lib/supabase';
import type { Footballer, MatchPatch, Pick, SpinRec } from './types';

/** Liga partilhada pelos 4 (uma só, privada). */
export const LEAGUE = 'mundial2026';

export function isOnline(): boolean {
  return !!getSupabase();
}

interface PickRow { friend_id: string; match_id: string; footballer_id: string; updated_at?: string }
interface SpinRow {
  friend_id: string; day: string; ajuda: string;
  match_id: string | null; second_id: string | null; target_footballer_id: string | null;
}

export async function fetchState(): Promise<{ picks: Pick[]; spins: Record<string, SpinRec> }> {
  const supa = getSupabase();
  if (!supa) return { picks: [], spins: {} };
  const [picksRes, spinsRes] = await Promise.all([
    supa.from('rr_picks').select('*').eq('league', LEAGUE),
    supa.from('rr_spins').select('*').eq('league', LEAGUE),
  ]);
  const picks = ((picksRes.data ?? []) as PickRow[]).map((r) => {
    const prefs = decodePrefs(r.footballer_id);
    return {
      friendId: r.friend_id, matchId: r.match_id,
      footballerId: prefs[0] ?? '', prefs, at: r.updated_at ?? '',
    };
  });
  const spins: Record<string, SpinRec> = {};
  for (const r of (spinsRes.data ?? []) as SpinRow[]) {
    spins[`${r.friend_id}|${r.day}`] = {
      ajuda: r.ajuda as SpinRec['ajuda'],
      matchId: r.match_id ?? undefined,
      secondId: r.second_id ?? undefined,
      targetFootballerId: r.target_footballer_id ?? undefined,
    };
  }
  return { picks, spins };
}

/**
 * Lista de preferências guardada no campo `footballer_id` (text) como array
 * JSON — evita migração de schema. Retrocompatível: valores antigos (id simples)
 * lêem-se como lista de 1.
 */
function decodePrefs(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch { /* id simples (formato antigo) */ }
  return [raw];
}

export async function pushPick(p: Pick): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  const prefs = p.prefs && p.prefs.length ? p.prefs : p.footballerId ? [p.footballerId] : [];
  await supa.from('rr_picks').upsert(
    { league: LEAGUE, friend_id: p.friendId, match_id: p.matchId, footballer_id: JSON.stringify(prefs), updated_at: new Date().toISOString() },
    { onConflict: 'league,friend_id,match_id' },
  );
}

interface RatingRow {
  match_id: string;
  lineup_confirmed: boolean;
  ratings: Record<string, number> | null;
  lineup: { home: Footballer[]; away: Footballer[] } | null;
}

/** Vai buscar todos os patches manuais (onze + notas) de um jogo. */
export async function fetchPatches(): Promise<Record<string, MatchPatch>> {
  const supa = getSupabase();
  if (!supa) return {};
  const res = await supa.from('rr_ratings').select('*').eq('league', LEAGUE);
  const out: Record<string, MatchPatch> = {};
  for (const r of (res.data ?? []) as RatingRow[]) {
    const raw = r.ratings ?? {};
    const homeGoals = typeof raw.__hg === 'number' ? raw.__hg : undefined;
    const awayGoals = typeof raw.__ag === 'number' ? raw.__ag : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __hg, __ag, ...ratings } = raw;
    out[r.match_id] = {
      matchId: r.match_id,
      lineupConfirmed: r.lineup_confirmed,
      ratings: Object.keys(ratings).length ? ratings : undefined,
      lineup: r.lineup ?? undefined,
      homeGoals,
      awayGoals,
    };
  }
  return out;
}

/** Guarda/atualiza o patch manual de um jogo (admin). */
export async function pushPatch(p: MatchPatch): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  const ratingsToStore = {
    ...(p.ratings ?? {}),
    ...(p.homeGoals != null ? { __hg: p.homeGoals } : {}),
    ...(p.awayGoals != null ? { __ag: p.awayGoals } : {}),
  };
  await supa.from('rr_ratings').upsert(
    {
      league: LEAGUE, match_id: p.matchId,
      lineup_confirmed: p.lineupConfirmed ?? false,
      ratings: ratingsToStore, lineup: p.lineup ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'league,match_id' },
  );
}

export async function pushSpin(friendId: string, day: string, rec: SpinRec): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  await supa.from('rr_spins').upsert(
    {
      league: LEAGUE, friend_id: friendId, day, ajuda: rec.ajuda,
      match_id: rec.matchId ?? null, second_id: rec.secondId ?? null,
      target_footballer_id: rec.targetFootballerId ?? null, updated_at: new Date().toISOString(),
    },
    { onConflict: 'league,friend_id,day' },
  );
}

interface PinRow { friend_id: string; pin: string }

/** PINs personalizados (partilhados). Sobrepõem-se aos PINs por defeito. */
export async function fetchPins(): Promise<Record<string, string>> {
  const supa = getSupabase();
  if (!supa) return {};
  const res = await supa.from('rr_pins').select('*').eq('league', LEAGUE);
  const out: Record<string, string> = {};
  for (const r of (res.data ?? []) as PinRow[]) out[r.friend_id] = r.pin;
  return out;
}

export async function pushPin(friendId: string, pin: string): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  await supa.from('rr_pins').upsert(
    { league: LEAGUE, friend_id: friendId, pin, updated_at: new Date().toISOString() },
    { onConflict: 'league,friend_id' },
  );
}

/** Admin: apaga TODAS as escolhas e rodas (recomeçar o jogo). */
export async function clearPicksAndSpins(): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  await Promise.all([
    supa.from('rr_picks').delete().eq('league', LEAGUE),
    supa.from('rr_spins').delete().eq('league', LEAGUE),
  ]);
}

/** Subscreve mudanças em tempo real; chama onChange a cada alteração. */
export function subscribe(onChange: () => void): () => void {
  const supa = getSupabase();
  if (!supa) return () => {};
  const ch = supa
    .channel('rr-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_picks', filter: `league=eq.${LEAGUE}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_spins', filter: `league=eq.${LEAGUE}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_ratings', filter: `league=eq.${LEAGUE}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_pins', filter: `league=eq.${LEAGUE}` }, onChange)
    .subscribe();
  return () => {
    void supa.removeChannel(ch);
  };
}
