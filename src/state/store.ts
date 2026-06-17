/**
 * Store central (Zustand).
 * ========================
 *
 * Mantém: configuração do motor, filtros do feed, value bets vivas, apostas
 * registadas (tracker) e banca. Corre o motor sobre cada lote de snapshots
 * recebido da fonte e faz atualização INCREMENTAL (preserva detectedAt das
 * apostas que continuam vivas) para o feed não "piscar".
 *
 * Persistência leve em localStorage para config, banca e apostas (pessoal,
 * sem backend obrigatório no MVP).
 */
import { create } from 'zustand';
import { evaluateFeed } from '../engine/engine';
import { scanArbitrage, type ArbOpportunity } from '../engine/arbitrage';
import {
  recordSample,
  computeMovement,
  pruneHistory,
  type MovementInfo,
} from './movement';
import type {
  ValueBet,
  EngineConfig,
  FeedFilters,
  MarketSnapshot,
  TrackedBet,
  TargetBook,
  AccountBook,
  BetResult,
} from '../lib/types';
import { DEFAULT_ENGINE_CONFIG, DEFAULT_FILTERS } from '../lib/types';
import { clv as computeClv } from '../lib/math/clv';

const LS_KEY = 'numeirotips:v1';

interface Persisted {
  config: EngineConfig;
  filters: FeedFilters;
  bets: TrackedBet[];
}

function load(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

function save(p: Persisted) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

const persisted = load();

export interface AppState {
  config: EngineConfig;
  filters: FeedFilters;
  /** Feed completo (não filtrado), ordenado por edge desc. */
  valueBets: ValueBet[];
  /** Snapshots em bruto do último ciclo (para a página de Análise por jogo). */
  snapshots: MarketSnapshot[];
  /** Index para preservar detectedAt entre ciclos. */
  prevIndex: Map<string, ValueBet>;
  /** Oportunidades de arbitragem (Fase 3), ordenadas por margem desc. */
  arbs: ArbOpportunity[];
  /** Movimento de linha por seleção (sinal de steam). */
  movement: Record<string, MovementInfo>;
  bets: TrackedBet[];
  connected: boolean;
  sourceName: string;
  lastTickAt: number;

  // ações
  ingestSnapshots: (snaps: MarketSnapshot[]) => void;
  /** Caminho live: value bets já calculadas no servidor (sem motor cliente). */
  setLiveValueBets: (bets: ValueBet[]) => void;
  setConfig: (patch: Partial<EngineConfig>) => void;
  setFilters: (patch: Partial<FeedFilters>) => void;
  setConnection: (connected: boolean, sourceName: string) => void;

  placeBet: (vb: ValueBet, opts?: { stake?: number; book?: TargetBook }) => void;
  settleBet: (id: string, result: BetResult, fairClosingOdd?: number) => void;
  removeBet: (id: string) => void;
  /** Regista uma aposta à mão (qualquer casa, ex.: Betano/Solverde). */
  addManualBet: (b: {
    label: string;
    book: AccountBook;
    stake: number;
    odd: number;
    fairOdd?: number;
  }) => void;
  /** Substitui config/apostas a partir de um backup importado. */
  importState: (data: { config?: Partial<EngineConfig>; bets?: TrackedBet[] }) => void;
}

export const useStore = create<AppState>((set, get) => ({
  config: { ...DEFAULT_ENGINE_CONFIG, ...persisted.config },
  filters: { ...DEFAULT_FILTERS, ...persisted.filters },
  valueBets: [],
  snapshots: [],
  prevIndex: new Map(),
  arbs: [],
  movement: {},
  bets: persisted.bets ?? [],
  connected: false,
  sourceName: '—',
  lastTickAt: 0,

  ingestSnapshots: (snaps) => {
    const { config, prevIndex } = get();
    const feed = evaluateFeed(snaps, config, prevIndex);
    const nextIndex = new Map(feed.map((vb) => [vb.id, vb]));

    // Arbitragem (Fase 3): só entre as casas-alvo onde se aposta (Betclic/1xBet).
    const arbs = scanArbitrage(snaps, config.activeBooks, config.arbMinMargin);

    // Movimento de linha: regista amostras das value bets vivas e calcula steam.
    const now = Date.now();
    const movement: Record<string, MovementInfo> = {};
    const aliveIds = new Set<string>();
    for (const vb of feed) {
      aliveIds.add(vb.id);
      recordSample(vb.id, { t: now, fairProb: vb.fair.prob, bestOdd: vb.bestOdd });
      movement[vb.id] = computeMovement(vb.id, now);
    }
    pruneHistory(aliveIds);

    set({ valueBets: feed, snapshots: snaps, prevIndex: nextIndex, arbs, movement, lastTickAt: now });
  },

  setLiveValueBets: (bets) => {
    const nextIndex = new Map(bets.map((vb) => [vb.id, vb]));
    // Movimento também no caminho live (a partir das value bets recebidas).
    const now = Date.now();
    const movement: Record<string, MovementInfo> = {};
    const aliveIds = new Set<string>();
    for (const vb of bets) {
      aliveIds.add(vb.id);
      recordSample(vb.id, { t: now, fairProb: vb.fair.prob, bestOdd: vb.bestOdd });
      movement[vb.id] = computeMovement(vb.id, now);
    }
    pruneHistory(aliveIds);
    set({ valueBets: bets, prevIndex: nextIndex, movement, lastTickAt: now });
  },

  setConfig: (patch) => {
    const config = { ...get().config, ...patch };
    set({ config });
    save({ config, filters: get().filters, bets: get().bets });
  },

  setFilters: (patch) => {
    const filters = { ...get().filters, ...patch };
    set({ filters });
    save({ config: get().config, filters, bets: get().bets });
  },

  setConnection: (connected, sourceName) => set({ connected, sourceName }),

  placeBet: (vb, opts) => {
    const book = opts?.book ?? vb.bestBook;
    const bookEdge = vb.books.find((b) => b.book === book) ?? vb.books[0];
    const stake = opts?.stake ?? vb.stake ?? 0;
    const bet: TrackedBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      valueBetId: vb.id,
      label: `${vb.event.home} v ${vb.event.away} — ${vb.selection.label}`,
      book,
      stake,
      odd: bookEdge.odd,
      fairOddAtBet: vb.fair.fairOdd,
      edgeAtBet: bookEdge.edge,
      result: 'pending',
      pnl: null,
      clv: null,
      placedAt: new Date().toISOString(),
      settledAt: null,
    };
    const bets = [bet, ...get().bets];
    set({ bets });
    save({ config: get().config, filters: get().filters, bets });
  },

  settleBet: (id, result, fairClosingOdd) => {
    const bets = get().bets.map((b) => {
      if (b.id !== id) return b;
      let pnl: number | null = null;
      if (result === 'won') pnl = round2(b.stake * (b.odd - 1));
      else if (result === 'lost') pnl = round2(-b.stake);
      else if (result === 'void') pnl = 0;
      else if (result === 'cashout') pnl = b.pnl; // mantém se já definido
      const clvVal =
        fairClosingOdd && fairClosingOdd > 0 ? computeClv(b.odd, fairClosingOdd) : b.clv;
      return {
        ...b,
        result,
        pnl,
        clv: clvVal,
        settledAt: new Date().toISOString(),
      };
    });
    set({ bets });
    save({ config: get().config, filters: get().filters, bets });
  },

  removeBet: (id) => {
    const bets = get().bets.filter((b) => b.id !== id);
    set({ bets });
    save({ config: get().config, filters: get().filters, bets });
  },

  addManualBet: ({ label, book, stake, odd, fairOdd }) => {
    const bet: TrackedBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      valueBetId: 'manual',
      label: label.trim() || 'Aposta manual',
      book,
      stake,
      odd,
      fairOddAtBet: fairOdd ?? odd,
      edgeAtBet: fairOdd && fairOdd > 1 ? (1 / fairOdd) * odd - 1 : 0,
      result: 'pending',
      pnl: null,
      clv: null,
      placedAt: new Date().toISOString(),
      settledAt: null,
    };
    const bets = [bet, ...get().bets];
    set({ bets });
    save({ config: get().config, filters: get().filters, bets });
  },

  importState: (data) => {
    const config = data.config
      ? { ...get().config, ...data.config }
      : get().config;
    const bets = data.bets ?? get().bets;
    set({ config, bets });
    save({ config, filters: get().filters, bets });
  },
}));

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Seletor: feed filtrado segundo os filtros atuais. */
export function selectFilteredFeed(state: AppState): ValueBet[] {
  const { valueBets, filters } = state;
  const q = filters.search.trim().toLowerCase();
  const horizon =
    filters.withinHours > 0 ? Date.now() + filters.withinHours * 3600_000 : Infinity;
  return valueBets.filter((vb) => {
    if (filters.market !== 'all' && vb.selection.market !== filters.market) return false;
    if (vb.bestEdge < filters.minEdge) return false;
    if (vb.bestOdd < filters.minOdd) return false;
    if (filters.maxOdd > 0 && vb.bestOdd > filters.maxOdd) return false;
    if (new Date(vb.event.startsAt).getTime() > horizon) return false;
    if (filters.book !== 'all' && !vb.books.some((b) => b.book === filters.book && b.isValue))
      return false;
    if (q) {
      const hay = `${vb.event.home} ${vb.event.away} ${vb.event.league} ${vb.selection.label}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
