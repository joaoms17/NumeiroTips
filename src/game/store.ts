/**
 * Estado central do RATING ROYALE (Zustand) + persistência local.
 *
 * Local-first: funciona já num dispositivo (os 4 passam o telemóvel) e tem
 * sync online (Supabase) quando configurado. Os jogos vêm da API-Football
 * (liveFixtures.ts); os palpites guardam-se em localStorage (modo local) ou
 * no Supabase (modo online).
 */
import { create } from 'zustand';
import type { AjudaId, Match, MatchPatch, Pick, SpinRec } from './types';
import { FRIENDS } from './config';
import { canPick, byKickoff, standingsWithHelps, helpsFromSpins, takenInMatch } from './scoring';
import { spinAjuda, ajudaMeta } from './wheel';
import { isOnline, pushPick, pushSpin, pushPatch } from './online';
import { clearFixturesCache } from './liveFixtures';

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

/** Dedup dos palpites do utilizador (sem semente — só dados reais). */
function mergePicks(user: Pick[]): Pick[] {
  const key = (p: Pick) => `${p.friendId}:${p.matchId}`;
  const map = new Map<string, Pick>();
  for (const p of user) map.set(key(p), p);
  return [...map.values()];
}

/** Sobrepõe os patches manuais (onze oficial + notas) aos jogos base. */
function applyPatches(base: Match[], patches: Record<string, MatchPatch>): Match[] {
  return base.map((m) => {
    const p = patches[m.id];
    if (!p) return m;
    return {
      ...m,
      lineupConfirmed: p.lineupConfirmed ?? m.lineupConfirmed,
      ratings: { ...(m.ratings ?? {}), ...(p.ratings ?? {}) },
      lineup: p.lineup ?? m.lineup,
    };
  });
}

const sortedDays = (matches: Match[]) =>
  [...new Set(matches.map((m) => m.day))].sort();

function defaultDay(matches: Match[]): string {
  const open = [...matches].sort(byKickoff).find((m) => m.status !== 'finished');
  return open?.day ?? sortedDays(matches).slice(-1)[0] ?? '';
}

export type FixturesStatus = 'loading' | 'ready' | 'empty';

export interface GameState {
  meId: string | null;
  /** Jogos visíveis = base (fixtures) + patches manuais sobrepostos. */
  matches: Match[];
  /** Jogos base, antes dos patches. */
  baseMatches: Match[];
  /** Patches manuais do admin (onze + notas), por matchId. */
  patches: Record<string, MatchPatch>;
  /** Estado do carregamento dos jogos reais (API-Football). */
  fixturesStatus: FixturesStatus;
  /** Bump para forçar novo fetch dos jogos (botão admin "atualizar"). */
  fixturesRefreshKey: number;
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
  /** Substitui a lista de jogos (ex.: dados reais do API-Football). */
  setMatches: (matches: Match[]) => void;
  /** Atualiza o estado de carregamento dos jogos. */
  setFixturesStatus: (status: FixturesStatus) => void;
  /** Força ir buscar de novo os jogos (limpa cache e re-fetch). */
  refreshFixtures: () => void;
  /** Online: substitui os patches manuais (após fetch/realtime). */
  setPatches: (patches: Record<string, MatchPatch>) => void;
  /** Admin: guarda um patch manual (onze + notas) e partilha (Supabase). */
  savePatch: (patch: MatchPatch) => void;
}

/** Fonte efetiva de palpites/spins: remota (online) ou local. */
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
  matches: [],
  baseMatches: [],
  patches: {},
  fixturesStatus: 'loading',
  fixturesRefreshKey: 0,
  userPicks: initialUser,
  spins: loadSpins(),
  online: ONLINE,
  remotePicks: [],
  remoteSpins: {},
  selectedDay: '',
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

  setMatches: (base) => set((s) => {
    const matches = applyPatches(base, s.patches);
    return {
      baseMatches: base,
      matches,
      // mantém o dia escolhido se ainda existir; senão vai para o default
      selectedDay: matches.some((m) => m.day === s.selectedDay) ? s.selectedDay : defaultDay(matches),
    };
  }),

  setFixturesStatus: (fixturesStatus) => set({ fixturesStatus }),

  refreshFixtures: () => {
    clearFixturesCache();
    set((s) => ({ fixturesRefreshKey: s.fixturesRefreshKey + 1 }));
  },

  setPatches: (patches) => set((s) => ({ patches, matches: applyPatches(s.baseMatches, patches) })),

  savePatch: (patch) => set((s) => {
    const patches = { ...s.patches, [patch.matchId]: patch };
    void pushPatch(patch);
    return { patches, matches: applyPatches(s.baseMatches, patches) };
  }),
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
