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
import type { Pick, SpinRec } from './types';

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
  const picks = ((picksRes.data ?? []) as PickRow[]).map((r) => ({
    friendId: r.friend_id, matchId: r.match_id, footballerId: r.footballer_id, at: r.updated_at ?? '',
  }));
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

export async function pushPick(p: Pick): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  await supa.from('rr_picks').upsert(
    { league: LEAGUE, friend_id: p.friendId, match_id: p.matchId, footballer_id: p.footballerId, updated_at: new Date().toISOString() },
    { onConflict: 'league,friend_id,match_id' },
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

/** Subscreve mudanças em tempo real; chama onChange a cada alteração. */
export function subscribe(onChange: () => void): () => void {
  const supa = getSupabase();
  if (!supa) return () => {};
  const ch = supa
    .channel('rr-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_picks', filter: `league=eq.${LEAGUE}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rr_spins', filter: `league=eq.${LEAGUE}` }, onChange)
    .subscribe();
  return () => {
    void supa.removeChannel(ch);
  };
}
