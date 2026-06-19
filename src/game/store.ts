/**
 * Estado central do RATING ROYALE (Zustand) + persistência local.
 *
 * Local-first: funciona já num dispositivo (os 4 passam o telemóvel) e está
 * pronto para sync online (Supabase) numa próxima fase — basta trocar a fonte
 * dos picks. Os palpites dos dias de exemplo (MOCK_PICKS) são a semente; os
 * palpites feitos a jogar guardam-se em localStorage.
 */
import { create } from 'zustand';
import type { Match, Pick } from './types';
import { FRIENDS } from './config';
import { MOCK_MATCHES, MOCK_PICKS } from './mockData';
import { canPick, byKickoff, standings as computeStandings } from './scoring';

const LS_ME = 'ratingroyale:me';
const LS_PICKS = 'ratingroyale:picks';

function loadUserPicks(): Pick[] {
  try {
    const raw = localStorage.getItem(LS_PICKS);
    return raw ? (JSON.parse(raw) as Pick[]) : [];
  } catch {
    return [];
  }
}
function saveUserPicks(picks: Pick[]) {
  try {
    localStorage.setItem(LS_PICKS, JSON.stringify(picks));
  } catch {
    /* ignore */
  }
}

/** Junta semente + palpites do utilizador (o do utilizador sobrepõe-se). */
function mergePicks(user: Pick[]): Pick[] {
  const key = (p: Pick) => `${p.friendId}:${p.matchId}`;
  const map = new Map<string, Pick>();
  for (const p of MOCK_PICKS) map.set(key(p), p);
  for (const p of user) map.set(key(p), p);
  return [...map.values()];
}

const sortedDays = (matches: Match[]) =>
  [...new Set(matches.map((m) => m.day))].sort();

function defaultDay(matches: Match[]): string {
  const open = [...matches].sort(byKickoff).find((m) => m.status !== 'finished');
  return open?.day ?? sortedDays(matches).slice(-1)[0] ?? '';
}

export interface GameState {
  meId: string | null;
  matches: Match[];
  userPicks: Pick[];
  selectedDay: string;
  /** mensagem efémera (erro/sucesso ao escolher). */
  flash: { kind: 'ok' | 'err'; text: string } | null;

  login: (name: string, pin: string) => boolean;
  logout: () => void;
  selectDay: (day: string) => void;
  choose: (matchId: string, footballerId: string) => void;
  setFlash: (f: GameState['flash']) => void;
}

const initialUser = loadUserPicks();
const savedMe = (() => {
  try {
    return localStorage.getItem(LS_ME);
  } catch {
    return null;
  }
})();

export const useGame = create<GameState>((set, get) => ({
  meId: savedMe,
  matches: MOCK_MATCHES,
  userPicks: initialUser,
  selectedDay: defaultDay(MOCK_MATCHES),
  flash: null,

  login: (name, pin) => {
    const f = FRIENDS.find(
      (x) => x.name.toLowerCase() === name.trim().toLowerCase() && x.pin === pin.trim(),
    );
    if (!f) return false;
    try {
      localStorage.setItem(LS_ME, f.id);
    } catch {
      /* ignore */
    }
    set({ meId: f.id });
    return true;
  },

  logout: () => {
    try {
      localStorage.removeItem(LS_ME);
    } catch {
      /* ignore */
    }
    set({ meId: null });
  },

  selectDay: (day) => set({ selectedDay: day }),

  choose: (matchId, footballerId) => {
    const { meId, matches } = get();
    if (!meId) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    const allPicks = mergePicks(get().userPicks);
    const check = canPick(allPicks, matches, meId, match, footballerId);
    if (!check.ok) {
      set({ flash: { kind: 'err', text: check.reason ?? 'Não dá.' } });
      return;
    }
    const key = `${meId}:${matchId}`;
    const next = get().userPicks.filter((p) => `${p.friendId}:${p.matchId}` !== key);
    next.push({ friendId: meId, matchId, footballerId, at: new Date().toISOString() });
    saveUserPicks(next);
    set({ userPicks: next, flash: { kind: 'ok', text: 'Escolha registada! 🔒' } });
  },

  setFlash: (f) => set({ flash: f }),
}));

// ---- seletores ----
export function allPicks(s: GameState): Pick[] {
  return mergePicks(s.userPicks);
}
export function dayList(s: GameState): string[] {
  return sortedDays(s.matches);
}
export function matchesOfDay(s: GameState, day: string): Match[] {
  return s.matches.filter((m) => m.day === day).sort(byKickoff);
}
export function myPick(s: GameState, matchId: string): Pick | undefined {
  if (!s.meId) return undefined;
  return allPicks(s).find((p) => p.matchId === matchId && p.friendId === s.meId);
}
export function standingsOf(s: GameState) {
  return computeStandings(FRIENDS, s.matches, allPicks(s));
}
