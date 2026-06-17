/**
 * Análise de um jogo: para um evento, junta todos os mercados, calcula os
 * preços justos (de-vig da régua sharp) e o edge de cada casa-alvo, e devolve
 * as melhores apostas (+EV) ordenadas. Base para a página de Análise.
 */
import { computeConsensusFair } from '../engine/engine';
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

export interface GamePreview {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  favorite: 'home' | 'draw' | 'away' | null;
  /** Texto do equilíbrio do jogo. */
  balance: string;
  /** Probabilidade justa de over na linha principal (se houver), e a linha. */
  overProb: number | null;
  overLine: number | null;
}

/** Leitura determinística do jogo a partir das prob. justas (1X2 + golos). */
export function gamePreview(a: GameAnalysis): GamePreview {
  const x12 = a.selections.filter((s) => s.market === '1x2');
  const p = (suffix: string) => x12.find((s) => s.selectionId.endsWith(`:${suffix}`))?.prob ?? 0;
  const homeProb = p('home');
  const drawProb = p('draw');
  const awayProb = p('away');

  const top = Math.max(homeProb, drawProb, awayProb);
  let favorite: GamePreview['favorite'] = null;
  if (top > 0) favorite = top === homeProb ? 'home' : top === awayProb ? 'away' : 'draw';

  const sideMax = Math.max(homeProb, awayProb);
  let balance = 'jogo equilibrado';
  if (sideMax >= 0.6) balance = 'claro favorito';
  else if (sideMax >= 0.45) balance = 'favorito ligeiro';

  const ou = a.selections.filter((s) => s.market === 'over_under');
  const over = ou.find((s) => s.selectionId.includes(':over'));
  return {
    homeProb,
    drawProb,
    awayProb,
    favorite,
    balance,
    overProb: over ? over.prob : null,
    overLine: over ? over.line : null,
  };
}

/** Confiança de uma sugestão: quantas casas a corroboram (1 = baixa). */
export function selectionConfidence(s: SelectionAnalysis): {
  level: 'baixa' | 'média' | 'alta';
  books: number;
  reason: string;
} {
  const positive = s.books.filter((b) => b.edge > 0).length;
  const books = s.books.length;
  if (books >= 2 && positive >= 2) return { level: 'alta', books, reason: 'várias casas a pagar acima do justo' };
  if (books >= 2) return { level: 'média', books, reason: 'duas casas a cotar' };
  return { level: 'baixa', books, reason: 'só uma casa a cotar — sem corroboração' };
}

export interface BestGame {
  eventId: string;
  home: string;
  away: string;
  startsAt: string;
  topEdge: number;
  topLabel: string;
  topMarket: string;
}

/** Jogo com mais valor agora (maior edge positivo entre os próximos jogos). */
export function bestValueGame(
  snapshots: MarketSnapshot[],
  config: EngineConfig,
): BestGame | null {
  let best: BestGame | null = null;
  for (const ev of upcomingEvents(snapshots, 20)) {
    const a = analyzeGame(snapshots, ev.id, config);
    const top = a?.topBets[0];
    if (!top || top.bestEdge <= 0) continue;
    if (!best || top.bestEdge > best.topEdge) {
      best = {
        eventId: ev.id,
        home: ev.home,
        away: ev.away,
        startsAt: ev.startsAt,
        topEdge: top.bestEdge,
        topLabel: top.label,
        topMarket: top.marketLabel,
      };
    }
  }
  return best;
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
    const fairs = computeConsensusFair(snap, config.sharpSource, config.devigMethod);
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
