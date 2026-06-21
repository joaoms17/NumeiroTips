/**
 * Estado central do RATING ROYALE (Zustand) + persistência local.
 *
 * Local-first: funciona já num dispositivo (os 4 passam o telemóvel) e tem
 * sync online (Supabase) quando configurado. Os jogos vêm da API-Football
 * (liveFixtures.ts); os palpites guardam-se em localStorage (modo local) ou
 * no Supabase (modo online).
 */
import { create } from 'zustand';
import type { AjudaId, Footballer, Match, MatchPatch, Pick, ResolvedPick, SpinRec } from './types';
import { FRIENDS } from './config';
import { byKickoff, standingsWithHelps, helpsFromSpins, takenInMatch, hasStarted, resolveMatch, MAX_PREFS } from './scoring';
import { spinAjuda, ajudaMeta } from './wheel';
import { isOnline, pushPick, pushSpin, pushPatch, pushPin, clearPicksAndSpins } from './online';
import { clearFixturesCache } from './liveFixtures';

const ONLINE = isOnline();

const LS_ME = 'ratingroyale:me';
const LS_PICKS = 'ratingroyale:picks';
const LS_SPINS = 'ratingroyale:spins';
const LS_PINS = 'ratingroyale:pins';

function loadPins(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_PINS);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function savePins(pins: Record<string, string>) {
  try {
    localStorage.setItem(LS_PINS, JSON.stringify(pins));
  } catch {
    /* ignore */
  }
}

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

/** Junta jogadores do onze ao plantel (sem duplicar por id). */
function unionPlayers(base: Footballer[], extra: Footballer[]): Footballer[] {
  const ids = new Set(base.map((b) => b.id));
  return [...base, ...extra.filter((x) => !ids.has(x.id))];
}

/** Sobrepõe os patches manuais (onze oficial + notas) aos jogos base. */
function applyPatches(base: Match[], patches: Record<string, MatchPatch>): Match[] {
  return base.map((m) => {
    const p = patches[m.id];
    if (!p) return m;
    let lineup = m.lineup;
    let starters = m.starters;
    if (p.lineup) {
      lineup = {
        home: unionPlayers(m.lineup.home, p.lineup.home),
        away: unionPlayers(m.lineup.away, p.lineup.away),
      };
      starters = [...p.lineup.home, ...p.lineup.away].map((x) => x.id);
    }
    if (p.starters) starters = p.starters;
    return {
      ...m,
      lineupConfirmed: p.lineupConfirmed ?? m.lineupConfirmed,
      ratings: { ...(m.ratings ?? {}), ...(p.ratings ?? {}) },
      lineup,
      starters,
      homeGoals: p.homeGoals ?? m.homeGoals,
      awayGoals: p.awayGoals ?? m.awayGoals,
    };
  });
}

/** Funde um patch novo no existente (notas juntam-se; resto sobrepõe-se). */
function mergePatch(prev: MatchPatch | undefined, next: MatchPatch): MatchPatch {
  return {
    matchId: next.matchId,
    lineupConfirmed: next.lineupConfirmed ?? prev?.lineupConfirmed,
    ratings: { ...(prev?.ratings ?? {}), ...(next.ratings ?? {}) },
    lineup: next.lineup ?? prev?.lineup,
    starters: next.starters ?? prev?.starters,
    homeGoals: next.homeGoals ?? prev?.homeGoals,
    awayGoals: next.awayGoals ?? prev?.awayGoals,
  };
}

const sortedDays = (matches: Match[]) =>
  [...new Set(matches.map((m) => m.day))].sort();

/**
 * Data "de hoje" (YYYY-MM-DD, hora LOCAL) com viragem às 07h: da meia-noite até
 * às 06:59 ainda conta como o dia anterior, para os jogos que acabam de
 * madrugada não saltarem logo para o dia seguinte.
 */
function effectiveToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - 7 * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultDay(matches: Match[]): string {
  const days = sortedDays(matches);
  if (days.length === 0) return '';
  const today = effectiveToday();
  // 1) há jogos hoje (viragem às 07h) → abre nesse dia
  if (days.includes(today)) return today;
  // 2) senão, o próximo dia com jogos a partir de hoje
  const upcoming = days.find((d) => d >= today);
  if (upcoming) return upcoming;
  // 3) senão (já passou tudo), o último dia
  return days[days.length - 1];
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
  /** PINs personalizados por amigo (sobrepõem-se aos defeitos). */
  pins: Record<string, string>;
  /** mensagem efémera (erro/sucesso ao escolher). */
  flash: { kind: 'ok' | 'err'; text: string } | null;

  login: (name: string, pin: string) => boolean;
  logout: () => void;
  selectDay: (day: string) => void;
  /** Submete a lista ORDENADA de preferências (até 5) para um jogo. */
  submitPrefs: (matchId: string, prefs: string[]) => void;
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
  /** Substitui os PINs personalizados (após fetch/realtime). */
  setPins: (pins: Record<string, string>) => void;
  /** Troca o PIN do amigo com sessão iniciada. Devolve erro ou null. */
  changePin: (newPin: string) => string | null;
  /** Admin: recomeça o jogo — apaga escolhas e rodas (local + Supabase). */
  resetGame: () => void;
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
  pins: loadPins(),
  flash: null,

  login: (name, pin) => {
    const f = FRIENDS.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (!f) return false;
    const expected = get().pins[f.id] ?? f.pin; // PIN personalizado ou o de defeito
    if (expected !== pin.trim()) return false;
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

  submitPrefs: (matchId, prefs) => {
    const s = get();
    const { meId, matches } = s;
    if (!meId) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    if (hasStarted(match)) {
      set({ flash: { kind: 'err', text: '⛔ O jogo já começou — escolhas fechadas.' } });
      return;
    }
    const clean = [...new Set(prefs.filter(Boolean))].slice(0, MAX_PREFS); // dedup + limite
    if (clean.length === 0) {
      set({ flash: { kind: 'err', text: 'Escolhe pelo menos 1 jogador.' } });
      return;
    }
    const pick: Pick = { friendId: meId, matchId, footballerId: clean[0], prefs: clean, at: new Date().toISOString() };
    if (s.online) {
      const remotePicks = upsertPick(s.remotePicks, pick);
      set({ remotePicks, flash: { kind: 'ok', text: 'Preferências guardadas! 🔒' } });
      void pushPick(pick);
    } else {
      const key = `${meId}:${matchId}`;
      const next = s.userPicks.filter((p) => `${p.friendId}:${p.matchId}` !== key);
      next.push(pick);
      saveUserPicks(next);
      set({ userPicks: next, flash: { kind: 'ok', text: 'Preferências guardadas! 🔒' } });
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
    if (!match || hasStarted(match)) {
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
    const merged = mergePatch(s.patches[patch.matchId], patch);
    const patches = { ...s.patches, [patch.matchId]: merged };
    void pushPatch(merged);
    return { patches, matches: applyPatches(s.baseMatches, patches) };
  }),

  setPins: (pins) => { savePins(pins); set({ pins }); },

  changePin: (newPin) => {
    const { meId } = get();
    if (!meId) return 'Não tens sessão.';
    if (!/^\d{4}$/.test(newPin)) return 'O PIN tem de ter 4 dígitos.';
    const pins = { ...get().pins, [meId]: newPin };
    savePins(pins);
    set({ pins, flash: { kind: 'ok', text: '🔒 PIN atualizado!' } });
    void pushPin(meId, newPin);
    return null;
  },

  resetGame: () => {
    saveUserPicks([]);
    saveSpins({});
    void clearPicksAndSpins();
    set({
      userPicks: [], spins: {}, remotePicks: [], remoteSpins: {},
      flash: { kind: 'ok', text: '🧹 Jogo recomeçado!' },
    });
  },
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
/** A minha lista ORDENADA de preferências para um jogo (vazia se ainda não submeti). */
export function myPrefs(s: GameState, matchId: string): string[] {
  const mine = myPick(s, matchId);
  if (!mine) return [];
  return mine.prefs && mine.prefs.length ? mine.prefs : mine.footballerId ? [mine.footballerId] : [];
}
/** Escolhas EFETIVAS resolvidas de um jogo (roubo = prioridade; dois = 2 melhores). */
export function resolvedForMatch(s: GameState, matchId: string): ResolvedPick[] {
  const m = s.matches.find((x) => x.id === matchId);
  if (!m) return [];
  return resolveMatch(FRIENDS, s.matches, m, picksOf(s), helpsFromSpins(spinsOf(s)));
}
/** Ids dos amigos que já submeteram preferências para um jogo (sem revelar quem). */
export function submittedFriends(s: GameState, matchId: string): Set<string> {
  return new Set(picksOf(s).filter((p) => p.matchId === matchId).map((p) => p.friendId));
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
/** Todos os spins (online ou local) — para mostrar ajudas de todos. */
export function allSpins(s: GameState): Record<string, SpinRec> {
  return spinsOf(s);
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
