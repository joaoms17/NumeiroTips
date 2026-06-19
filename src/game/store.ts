/**
 * Estado central do RATING ROYALE (Zustand) + persistência local.
 *
 * Local-first: funciona já num dispositivo (os 4 passam o telemóvel) e está
 * pronto para sync online (Supabase) numa próxima fase — basta trocar a fonte
 * dos picks. Os palpites dos dias de exemplo (MOCK_PICKS) são a semente; os
 * palpites feitos a jogar guardam-se em localStorage.
 */
import { create } from 'zustand';
import type { AjudaId, Match, Pick, SpinRec } from './types';
import { FRIENDS } from './config';
import { MOCK_MATCHES, MOCK_PICKS } from './mockData';
import { canPick, byKickoff, standingsWithHelps, helpsFromSpins, takenInMatch } from './scoring';
import { spinAjuda, ajudaMeta } from './wheel';
import { isOnline, pushPick, pushSpin } from './online';

const ONLINE = isOnline();

const LS_ME = 'ratingroyale:me';
const LS_PICKS = 'ratingroyale:picks';
const LS_SPINS = 'ratingroyale:spins';

function loadSpins(): Record<string, SpinRec> {
  try {
    const raw = localStorage.getItem(LS_SPINS);
    return raw ? (JSON.parse(raw) as Record<string, SpinRec>) : {};
  } catch {
    return {};
  }
}
function saveSpins(spins: Record<string, SpinRec>) {
  try {
    localStorage.setItem(LS_SPINS, JSON.stringify(spins));
  } catch {
    /* ignore */
  }
}
const spinKey = (friendId: string, day: string) => `${friendId}|${day}`;

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
  spins: Record<string, SpinRec>;
  /** Online: estado partilhado vindo do Supabase (todos os amigos). */
  online: boolean;
  remotePicks: Pick[];
  remoteSpins: Record<string, SpinRec>;
  selectedDay: string;
  /** mensagem efémera (erro/sucesso ao escolher). */
  flash: { kind: 'ok' | 'err'; text: string } | null;

  login: (name: string, pin: string) => boolean;
  logout: () => void;
  selectDay: (day: string) => void;
  choose: (matchId: string, footballerId: string) => void;
  /** Roda a roda do dia (1×/dia). Devolve a ajuda sorteada. */
  spin: (day: string) => AjudaId;
  /** Aplica a ajuda do dia a um jogo (com 2º jogador / alvo conforme o tipo). */
  applyHelp: (day: string, matchId: string, opts?: { secondId?: string; targetFootballerId?: string }) => void;
  /** Online: substitui o estado partilhado (após fetch/realtime). */
  setRemote: (data: { picks: Pick[]; spins: Record<string, SpinRec> }) => void;
  setFlash: (f: GameState['flash']) => void;
}

/** Fonte efetiva de palpites/spins: remota (online) ou local+semente. */
function picksOf(s: GameState): Pick[] {
  return s.online ? s.remotePicks : mergePicks(s.userPicks);
}
function spinsOf(s: GameState): Record<string, SpinRec> {
  return s.online ? s.remoteSpins : s.spins;
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
  spins: loadSpins(),
  online: ONLINE,
  remotePicks: [],
  remoteSpins: {},
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
    const s = get();
    const { meId, matches } = s;
    if (!meId) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    const check = canPick(picksOf(s), matches, meId, match, footballerId);
    if (!check.ok) {
      set({ flash: { kind: 'err', text: check.reason ?? 'Não dá.' } });
      return;
    }
    // jogador roubado por outro neste jogo não pode ser reescolhido
    const robbed = helpsFromSpins(spinsOf(s)).some(
      (h) => h.ajuda === 'rouba' && h.matchId === matchId && h.friendId !== meId && h.targetFootballerId === footballerId,
    );
    if (robbed) {
      set({ flash: { kind: 'err', text: 'Esse jogador foi roubado — escolhe outro.' } });
      return;
    }
    const pick: Pick = { friendId: meId, matchId, footballerId, at: new Date().toISOString() };
    if (s.online) {
      const remotePicks = upsertPick(s.remotePicks, pick);
      set({ remotePicks, flash: { kind: 'ok', text: 'Escolha registada! 🔒' } });
      void pushPick(pick);
    } else {
      const key = `${meId}:${matchId}`;
      const next = s.userPicks.filter((p) => `${p.friendId}:${p.matchId}` !== key);
      next.push(pick);
      saveUserPicks(next);
      set({ userPicks: next, flash: { kind: 'ok', text: 'Escolha registada! 🔒' } });
    }
  },

  spin: (day) => {
    const s = get();
    const { meId } = s;
    if (!meId) return 'nenhuma';
    const key = spinKey(meId, day);
    const existing = spinsOf(s)[key];
    if (existing) return existing.ajuda; // já rodou hoje
    const ajuda = spinAjuda();
    const rec: SpinRec = { ajuda };
    if (s.online) {
      set({ remoteSpins: { ...s.remoteSpins, [key]: rec } });
      void pushSpin(meId, day, rec);
    } else {
      const spins = { ...s.spins, [key]: rec };
      saveSpins(spins);
      set({ spins });
    }
    return ajuda;
  },

  applyHelp: (day, matchId, opts) => {
    const s = get();
    const { meId, matches } = s;
    if (!meId) return;
    const key = spinKey(meId, day);
    const rec = spinsOf(s)[key];
    if (!rec) {
      set({ flash: { kind: 'err', text: 'Roda a roda primeiro.' } });
      return;
    }
    if (rec.ajuda === 'nenhuma') return;
    if (rec.matchId) {
      set({ flash: { kind: 'err', text: 'Já usaste a ajuda de hoje.' } });
      return;
    }
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.status !== 'upcoming') {
      set({ flash: { kind: 'err', text: 'Esse jogo já fechou.' } });
      return;
    }
    const next: SpinRec = { ...rec, matchId, secondId: opts?.secondId, targetFootballerId: opts?.targetFootballerId };
    if (s.online) {
      set({ remoteSpins: { ...s.remoteSpins, [key]: next }, flash: { kind: 'ok', text: `Ajuda ${ajudaMeta(rec.ajuda).emoji} aplicada!` } });
      void pushSpin(meId, day, next);
    } else {
      const spins = { ...s.spins, [key]: next };
      saveSpins(spins);
      set({ spins, flash: { kind: 'ok', text: `Ajuda ${ajudaMeta(rec.ajuda).emoji} aplicada!` } });
    }
  },

  setRemote: ({ picks, spins }) => set({ remotePicks: picks, remoteSpins: spins }),

  setFlash: (f) => set({ flash: f }),
}));

/** Upsert de um pick (substitui o do mesmo amigo+jogo). */
function upsertPick(picks: Pick[], p: Pick): Pick[] {
  const k = `${p.friendId}:${p.matchId}`;
  return [...picks.filter((x) => `${x.friendId}:${x.matchId}` !== k), p];
}

// ---- seletores ----
export function allPicks(s: GameState): Pick[] {
  return picksOf(s);
}
export function dayList(s: GameState): string[] {
  return sortedDays(s.matches);
}
export function matchesOfDay(s: GameState, day: string): Match[] {
  return s.matches.filter((m) => m.day === day).sort(byKickoff);
}
export function myPick(s: GameState, matchId: string): Pick | undefined {
  if (!s.meId) return undefined;
  return picksOf(s).find((p) => p.matchId === matchId && p.friendId === s.meId);
}
export function standingsOf(s: GameState) {
  return standingsWithHelps(FRIENDS, s.matches, picksOf(s), helpsFromSpins(spinsOf(s)));
}
/** Spin do amigo atual para um dia (ou undefined se ainda não rodou). */
export function mySpin(s: GameState, day: string): SpinRec | undefined {
  if (!s.meId) return undefined;
  return spinsOf(s)[`${s.meId}|${day}`];
}
/** Jogadores indisponíveis num jogo: escolhidos por outros + roubados. */
export function claimedInMatch(s: GameState, matchId: string, exceptFriendId: string): Set<string> {
  const set = takenInMatch(picksOf(s), matchId, exceptFriendId);
  for (const h of helpsFromSpins(spinsOf(s))) {
    if (h.ajuda === 'rouba' && h.matchId === matchId && h.friendId !== exceptFriendId && h.targetFootballerId)
      set.add(h.targetFootballerId);
  }
  return set;
}
/** O meu jogador deste jogo foi roubado por outro? */
export function iWasRobbed(s: GameState, matchId: string): boolean {
  if (!s.meId) return false;
  const mine = myPick(s, matchId);
  if (!mine) return false;
  return helpsFromSpins(spinsOf(s)).some(
    (h) => h.ajuda === 'rouba' && h.matchId === matchId && h.friendId !== s.meId && h.targetFootballerId === mine.footballerId,
  );
}
