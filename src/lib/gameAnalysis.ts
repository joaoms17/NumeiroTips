/**
 * Análise de um jogo: para um evento, junta todos os mercados, calcula os
 * preços justos (de-vig da régua sharp) e o edge de cada casa-alvo, e devolve
 * as melhores apostas (+EV) ordenadas. Base para a página de Análise.
 */
import { computeFairPrices } from '../engine/engine';
import { expectedValue } from './math/ev';
import { marketLabel } from './format';
import type { MarketSnapshot, EngineConfig, SportEvent, TargetBook, BookId } from './types';

export interface SelectionAnalysis {
  selectionId: string;
  market: string;
  marketLabel: string;
  line: number | null;
  label: string;
  prob: number; // prob. justa
  fairOdd: number;
  books: Array<{ book: TargetBook; odd: number; edge: number }>;
  bestBook: TargetBook | null;
  bestOdd: number;
  bestEdge: number;
}

export interface GameAnalysis {
  event: SportEvent;
  markets: string[];
  selections: SelectionAnalysis[]; // todas, ordenadas por edge desc
  topBets: SelectionAnalysis[]; // só +EV (edge > 0)
}

/** Lista os próximos jogos distintos (por id de evento) a partir dos snapshots. */
export function upcomingEvents(snapshots: MarketSnapshot[], limit = 10): SportEvent[] {
  const byId = new Map<string, SportEvent>();
  for (const s of snapshots) byId.set(s.event.id, s.event);
  return [...byId.values()]
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, limit);
}

export function analyzeGame(
  snapshots: MarketSnapshot[],
  eventId: string,
  config: EngineConfig,
): GameAnalysis | null {
  const snaps = snapshots.filter((s) => s.event.id === eventId);
  if (snaps.length === 0) return null;
  const event = snaps[0].event;

  const selections: SelectionAnalysis[] = [];
  const markets = new Set<string>();

  for (const snap of snaps) {
    const fairs = computeFairPrices(snap, config.sharpSource, config.devigMethod);
    if (!fairs) continue;
    markets.add(snap.market);
    const fairBySel = new Map(fairs.map((f) => [f.selectionId, f]));

    for (const sel of snap.selections) {
      const fair = fairBySel.get(sel.id);
      if (!fair) continue;
      const books: SelectionAnalysis['books'] = [];
      for (const book of config.activeBooks) {
        const q = snap.quotes[book as BookId]?.[sel.id];
        if (q && q.odd > 1) {
          books.push({ book, odd: q.odd, edge: expectedValue(fair.prob, q.odd) });
        }
      }
      if (books.length === 0) continue;
      const best = books.reduce((a, b) => (b.edge > a.edge ? b : a), books[0]);
      selections.push({
        selectionId: sel.id,
        market: snap.market,
        marketLabel: marketLabel(snap.market),
        line: snap.line,
        label: sel.label,
        prob: fair.prob,
        fairOdd: fair.fairOdd,
        books: books.sort((a, b) => b.edge - a.edge),
        bestBook: best.edge > 0 ? best.book : null,
        bestOdd: best.odd,
        bestEdge: best.edge,
      });
    }
  }

  selections.sort((a, b) => b.bestEdge - a.bestEdge);
  return {
    event,
    markets: [...markets],
    selections,
    topBets: selections.filter((s) => s.bestEdge > 0),
  };
}
