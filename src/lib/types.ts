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
  '1xbet': { label: '1xBet', risk: 'licenciada', color: '#d9a441' },
};

/**
 * Casas onde se pode registar apostas no Tracker/Exposição (gestão de conta).
 * Inclui as licenciadas pela SRIJ em Portugal + a 1xBet (zona cinzenta).
 * NOTA: a deteção de value bets (feed) só funciona nas casas com odds na fonte
 * de dados (Betclic, 1xBet); as restantes servem para registo manual e gestão
 * de exposição por casa, já que apostas nelas é à mão.
 */
export type AccountBook =
  | 'betclic'
  | '1xbet'
  | 'betano'
  | 'placard'
  | 'solverde'
  | 'esc_online'
  | 'bacana'
  | 'nossa_aposta'
  | 'moosh'
  | 'casino_portugal'
  | 'leovegas'
  | 'bwin'
  | 'lebull'
  | 'luckia'
  | 'betway'
  | 'betplay';

export const ACCOUNT_BOOK_META: Record<AccountBook, { label: string; risk: BookRisk }> = {
  betclic: { label: 'Betclic', risk: 'licenciada' },
  betano: { label: 'Betano', risk: 'licenciada' },
  placard: { label: 'Placard', risk: 'licenciada' },
  solverde: { label: 'Solverde', risk: 'licenciada' },
  esc_online: { label: 'ESC Online', risk: 'licenciada' },
  bacana: { label: 'Bacana Play', risk: 'licenciada' },
  nossa_aposta: { label: 'Nossa Aposta', risk: 'licenciada' },
  moosh: { label: 'Moosh', risk: 'licenciada' },
  casino_portugal: { label: 'Casino Portugal', risk: 'licenciada' },
  leovegas: { label: 'LeoVegas', risk: 'licenciada' },
  bwin: { label: 'Bwin', risk: 'licenciada' },
  lebull: { label: 'LeBull', risk: 'licenciada' },
  luckia: { label: 'Luckia', risk: 'licenciada' },
  betway: { label: 'Betway', risk: 'licenciada' },
  betplay: { label: 'Betplay (Betpt)', risk: 'licenciada' },
  '1xbet': { label: '1xBet', risk: 'licenciada' },
};

export const ACCOUNT_BOOKS = Object.keys(ACCOUNT_BOOK_META) as AccountBook[];

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
  /** Régua(s) usada(s). */
  source: SharpBook;
  /** Nº de réguas sharp usadas no consenso (1 ou 2). */
  sharps: number;
  /** Divergência entre as sharps neste mercado (pp; 0 = só uma sharp). */
  divergence: number;
  computedAt: string;
}

export type Reliability = 'alta' | 'média' | 'baixa';

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
  /** Fiabilidade do sinal (consenso de sharps + corroboração + sanidade). */
  reliability: Reliability;
  /** True se o edge é implausivelmente grande (provável erro de odd). */
  suspicious: boolean;
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
  /** Margem mínima para sinalizar uma arbitragem (default 0.5%). */
  arbMinMargin: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  edgeThreshold: 0.02,
  devigMethod: 'shin',
  kellyFraction: 0.25,
  bankroll: 1000,
  stakeCap: 0.05,
  sharpSource: 'pinnacle',
  activeBooks: ['betclic', '1xbet'],
  arbMinMargin: 0.005,
};

/** Filtros aplicados ao feed na UI. */
export interface FeedFilters {
  market: MarketType | 'all';
  minEdge: number;
  minOdd: number;
  /** Odd máxima (0 = sem limite). */
  maxOdd: number;
  /** Só jogos a começar nas próximas X horas (0 = qualquer altura). */
  withinHours: number;
  /** Esconder sinais de baixa fiabilidade (1 sharp / sharps a divergir / suspeitos). */
  onlyReliable: boolean;
  book: TargetBook | 'all';
  search: string;
}

export const DEFAULT_FILTERS: FeedFilters = {
  market: 'all',
  minEdge: 0.02,
  minOdd: 1.0,
  maxOdd: 0,
  withinHours: 0,
  onlyReliable: false,
  book: 'all',
  search: '',
};

// ---- Bet tracker (Fase 2) ----

export type BetResult = 'pending' | 'won' | 'lost' | 'void' | 'cashout';

export interface TrackedBet {
  id: string;
  valueBetId: string;
  label: string; // descrição legível da aposta
  book: AccountBook;
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
