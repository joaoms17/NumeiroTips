/**
 * Scanner de arbitragem sobre os snapshots de mercado.
 *
 * Para cada mercado, tenta cobrir todos os resultados usando a melhor odd entre
 * as casas onde se pode APOSTAR — as casas-alvo (Betclic, 1xBet) e a Betfair
 * Exchange (back). A régua sharp (Pinnacle) fica de fora por ser só referência.
 *
 * Devolve as oportunidades com margem garantida ≥ limiar, ordenadas por margem.
 */
import { findArbitrage, type ArbOutcome, type ArbLeg } from '../lib/math/arbitrage';
import type { MarketSnapshot, BookId, SportEvent, MarketType } from '../lib/types';

/** Casas onde se pode efetivamente apostar para fechar a arbitragem. */
const BACKABLE_BOOKS: BookId[] = ['betclic', '1xbet', 'betfair'];

export interface ArbOpportunity {
  id: string;
  event: SportEvent;
  market: MarketType;
  line: number | null;
  bookSum: number;
  margin: number;
  legs: ArbLeg[];
  detectedAt: string;
}

export function scanMarketArbitrage(
  snap: MarketSnapshot,
  books: BookId[] = BACKABLE_BOOKS,
  minMargin = 0,
  totalStake = 100,
): ArbOpportunity | null {
  const outcomes: ArbOutcome[] = snap.selections.map((sel) => ({
    selectionId: sel.id,
    label: sel.label,
    quotes: books
      .map((b) => {
        const q = snap.quotes[b]?.[sel.id];
        return q && q.odd > 1 ? { book: b, odd: q.odd } : null;
      })
      .filter((q): q is { book: BookId; odd: number } => q != null),
  }));

  const arb = findArbitrage(outcomes, totalStake);
  if (!arb.isArb || arb.margin < minMargin) return null;

  const line = snap.line;
  return {
    id: `${snap.event.id}:${snap.market}${line != null ? `:${line}` : ''}`,
    event: snap.event,
    market: snap.market,
    line,
    bookSum: arb.bookSum,
    margin: arb.margin,
    legs: arb.legs,
    detectedAt: new Date().toISOString(),
  };
}

export function scanArbitrage(
  snaps: MarketSnapshot[],
  books: BookId[] = BACKABLE_BOOKS,
  minMargin = 0,
  totalStake = 100,
): ArbOpportunity[] {
  const out: ArbOpportunity[] = [];
  for (const snap of snaps) {
    const opp = scanMarketArbitrage(snap, books, minMargin, totalStake);
    if (opp) out.push(opp);
  }
  return out.sort((a, b) => b.margin - a.margin);
}
