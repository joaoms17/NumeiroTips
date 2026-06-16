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
import type {
  ValueBet,
  EngineConfig,
  FeedFilters,
  MarketSnapshot,
  TrackedBet,
  TargetBook,
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
  /** Index para preservar detectedAt entre ciclos. */
  prevIndex: Map<string, ValueBet>;
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
}

export const useStore = create<AppState>((set, get) => ({
  config: persisted.config ?? DEFAULT_ENGINE_CONFIG,
  filters: persisted.filters ?? DEFAULT_FILTERS,
  valueBets: [],
  prevIndex: new Map(),
  bets: persisted.bets ?? [],
  connected: false,
  sourceName: '—',
  lastTickAt: 0,

  ingestSnapshots: (snaps) => {
    const { config, prevIndex } = get();
    const feed = evaluateFeed(snaps, config, prevIndex);
    const nextIndex = new Map(feed.map((vb) => [vb.id, vb]));
    set({ valueBets: feed, prevIndex: nextIndex, lastTickAt: Date.now() });
  },

  setLiveValueBets: (bets) => {
    const nextIndex = new Map(bets.map((vb) => [vb.id, vb]));
    set({ valueBets: bets, prevIndex: nextIndex, lastTickAt: Date.now() });
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
}));

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Seletor: feed filtrado segundo os filtros atuais. */
export function selectFilteredFeed(state: AppState): ValueBet[] {
  const { valueBets, filters } = state;
  const q = filters.search.trim().toLowerCase();
  return valueBets.filter((vb) => {
    if (filters.market !== 'all' && vb.selection.market !== filters.market) return false;
    if (vb.bestEdge < filters.minEdge) return false;
    if (vb.bestOdd < filters.minOdd) return false;
    if (filters.book !== 'all' && !vb.books.some((b) => b.book === filters.book && b.isValue))
      return false;
    if (q) {
      const hay = `${vb.event.home} ${vb.event.away} ${vb.event.league} ${vb.selection.label}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
