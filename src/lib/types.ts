/**
 * Tipos de domínio do NumeiroTips.
 * Espelham o modelo de dados Supabase mas servem também o motor em memória.
 */

export type Sport = 'football';

export type BookType = 'sharp' | 'soft' | 'exchange';

/** Casas onde efetivamente se aposta (casas-alvo). */
export type TargetBook = 'betclic' | '1xbet';

/** Réguas sharp (só para calcular o justo, NÃO para apostar). */
export type SharpBook = 'pinnacle' | 'betfair';

export type BookId = TargetBook | SharpBook;

/** Risco regulatório/de conta associado a cada casa-alvo. */
export type BookRisk = 'licenciada' | 'cinzenta';

export const BOOK_META: Record<TargetBook, { label: string; risk: BookRisk; color: string }> = {
  betclic: { label: 'Betclic', risk: 'licenciada', color: '#1e90ff' },
  '1xbet': { label: '1xBet', risk: 'cinzenta', color: '#d9a441' },
};

export type MarketType =
  | '1x2'
  | 'over_under'
  | 'btts'
  | 'ah' // handicap asiático
  | 'dnb'; // empate anula aposta

export interface SportEvent {
  id: string;
  sport: Sport;
  league: string;
  home: string;
  away: string;
  /** ISO timestamp do início. */
  startsAt: string;
}

export interface Selection {
  /** id estável do mercado+seleção (ex.: "evt1:1x2:home"). */
  id: string;
  eventId: string;
  market: MarketType;
  /** Linha quando aplicável (ex.: 2.5 para over/under, -0.5 para AH). */
  line: number | null;
  /** Rótulo da seleção (ex.: "Casa", "Over 2.5", "Ambas marcam: Sim"). */
  label: string;
}

/** Uma cotação capturada de uma casa para uma seleção. */
export interface OddQuote {
  selectionId: string;
  book: BookId;
  odd: number;
  /** Volume/liquidez quando a fonte fornece (exchanges). */
  volume?: number;
  /** ISO timestamp da captura. */
  capturedAt: string;
}

/**
 * Snapshot completo de um mercado vindo da fonte (todas as seleções do mercado
 * e todas as casas que o cotam). É a unidade que o motor processa.
 */
export interface MarketSnapshot {
  event: SportEvent;
  market: MarketType;
  line: number | null;
  /** Todas as seleções deste mercado (ex.: [Casa, Empate, Fora]). */
  selections: Selection[];
  /** Cotações indexadas por book → (selectionId → odd). */
  quotes: Record<BookId, Record<string, OddQuote>>;
}

export interface FairPrice {
  selectionId: string;
  prob: number;
  fairOdd: number;
  method: 'shin' | 'proportional';
  /** Régua usada (qual sharp). */
  source: SharpBook;
  computedAt: string;
}

/** Resultado por casa-alvo dentro de uma value bet. */
export interface BookEdge {
  book: TargetBook;
  odd: number;
  edge: number;
  isValue: boolean;
  /** Deep-link para o boletim (Fase 2). */
  deepLink?: string;
}

/** A linha do feed: uma seleção +EV com line shopping entre as casas-alvo. */
export interface ValueBet {
  id: string;
  event: SportEvent;
  selection: Selection;
  fair: FairPrice;
  /** Edge por casa-alvo (Betclic, 1xBet). */
  books: BookEdge[];
  /** Casa recomendada (melhor odd entre as +EV). */
  bestBook: TargetBook;
  bestOdd: number;
  bestEdge: number;
  /** Fração de Kelly cheio e stake recomendado para a banca atual. */
  kellyFraction: number;
  stake: number | null;
  /** Quando foi detetada (para o "detetado há Xs"). */
  detectedAt: string;
  /** Atualizado a cada re-cálculo enquanto a aposta continua viva. */
  updatedAt: string;
}

export interface EngineConfig {
  /** Limiar mínimo de edge para sinalizar (default 0.02 = 2%). */
  edgeThreshold: number;
  /** Método de de-vig preferido. */
  devigMethod: 'shin' | 'proportional';
  /** Fração de Kelly (default 0.25). */
  kellyFraction: number;
  /** Banca atual (€). */
  bankroll: number;
  /** Teto de fração da banca por aposta (segurança). */
  stakeCap: number;
  /** Régua sharp preferida. */
  sharpSource: SharpBook;
  /** Casas-alvo ativas (MVP começa só com Betclic). */
  activeBooks: TargetBook[];
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  edgeThreshold: 0.02,
  devigMethod: 'shin',
  kellyFraction: 0.25,
  bankroll: 1000,
  stakeCap: 0.05,
  sharpSource: 'pinnacle',
  activeBooks: ['betclic', '1xbet'],
};

/** Filtros aplicados ao feed na UI. */
export interface FeedFilters {
  market: MarketType | 'all';
  minEdge: number;
  minOdd: number;
  book: TargetBook | 'all';
  search: string;
}

export const DEFAULT_FILTERS: FeedFilters = {
  market: 'all',
  minEdge: 0.02,
  minOdd: 1.0,
  book: 'all',
  search: '',
};

// ---- Bet tracker (Fase 2) ----

export type BetResult = 'pending' | 'won' | 'lost' | 'void' | 'cashout';

export interface TrackedBet {
  id: string;
  valueBetId: string;
  label: string; // descrição legível da aposta
  book: TargetBook;
  stake: number;
  odd: number;
  fairOddAtBet: number;
  edgeAtBet: number;
  result: BetResult;
  pnl: number | null;
  /** Closing line value, preenchido ao liquidar. */
  clv: number | null;
  placedAt: string;
  settledAt: string | null;
}
