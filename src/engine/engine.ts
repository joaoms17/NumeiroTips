/**
 * O MOTOR (+EV engine)
 * ====================
 *
 * Pega num MarketSnapshot (preços sharp + casas-alvo para um mercado) e produz
 * value bets. Pipeline, exatamente como na lógica central:
 *
 *   1. Lê o preço sharp (Pinnacle/Betfair) de TODAS as seleções do mercado.
 *   2. De-vig (Shin, fallback proporcional) → prob. e odd justas por seleção.
 *   3. Lê a MESMA seleção só na Betclic e na 1xBet.
 *   4. edge = odd_casa · prob_justa − 1, por casa.
 *   5. Sinaliza onde edge ≥ limiar; recomenda a odd mais alta entre as +EV.
 *   6. (ordenação por edge é feita a jusante, no store/feed.)
 *
 * É puro e sem dependências de I/O → reutilizável no browser e numa Edge
 * Function (Deno). Os testes do motor matemático cobrem as fórmulas; aqui a
 * orquestração junta tudo.
 */

import { devig } from '../lib/math/devig';
import { expectedValue, lineShop } from '../lib/math/ev';
import { kelly } from '../lib/math/kelly';
import type {
  MarketSnapshot,
  ValueBet,
  EngineConfig,
  FairPrice,
  BookEdge,
  TargetBook,
  SharpBook,
  BookId,
} from '../lib/types';
import { deepLinkFor } from '../lib/deeplinks';

/** Calcula os preços justos de um mercado a partir da régua sharp escolhida. */
export function computeFairPrices(
  snap: MarketSnapshot,
  source: SharpBook,
  method: 'shin' | 'proportional',
): FairPrice[] | null {
  const sharpQuotes = snap.quotes[source as BookId];
  if (!sharpQuotes) return null;

  // Mantém a ordem das seleções e garante que a sharp cota todas.
  const odds: number[] = [];
  for (const sel of snap.selections) {
    const q = sharpQuotes[sel.id];
    if (!q || !(q.odd > 1)) return null; // sharp incompleta → não dá para de-vig
    odds.push(q.odd);
  }

  const result = devig(odds, method);
  const now = new Date().toISOString();
  return snap.selections.map((sel, i) => ({
    selectionId: sel.id,
    prob: result.outcomes[i].prob,
    fairOdd: result.outcomes[i].fairOdd,
    method: result.method,
    source,
    computedAt: now,
  }));
}

/**
 * Avalia um mercado e devolve as value bets (uma por seleção que tenha ≥ 1
 * casa-alvo a cotá-la). Inclui seleções neutras/−EV também? Não: só devolve
 * linhas cujo MELHOR edge entre as casas-alvo cumpre o limiar. Isto mantém o
 * feed focado em +EV. (Para análise podes baixar o limiar a 0.)
 */
export function evaluateMarket(
  snap: MarketSnapshot,
  config: EngineConfig,
  previous?: Map<string, ValueBet>,
): ValueBet[] {
  const fairs = computeFairPrices(snap, config.sharpSource, config.devigMethod);
  if (!fairs) return [];

  const fairBySel = new Map(fairs.map((f) => [f.selectionId, f]));
  const out: ValueBet[] = [];
  const now = new Date().toISOString();

  for (const sel of snap.selections) {
    const fair = fairBySel.get(sel.id);
    if (!fair) continue;

    // Cotações das casas-alvo ativas para esta seleção.
    const quotes: Array<{ book: TargetBook; odd: number }> = [];
    for (const book of config.activeBooks) {
      const q = snap.quotes[book as BookId]?.[sel.id];
      if (q && q.odd > 1) quotes.push({ book, odd: q.odd });
    }
    if (quotes.length === 0) continue;

    const books: BookEdge[] = quotes.map((q) => {
      const e = expectedValue(fair.prob, q.odd);
      return {
        book: q.book,
        odd: q.odd,
        edge: e,
        isValue: e >= config.edgeThreshold,
        deepLink: deepLinkFor(q.book, snap, sel),
      };
    });

    // Só entra no feed se pelo menos uma casa-alvo for +EV.
    if (!books.some((b) => b.isValue)) continue;

    const shop = lineShop(
      fair.prob,
      quotes.map((q) => ({ book: q.book, odd: q.odd })),
      config.edgeThreshold,
    );
    const bestBook = shop.bestBook as TargetBook;
    const bestOdd = shop.bestOdd;
    const bestEdge = shop.bestEdge;

    const k = kelly({
      prob: fair.prob,
      odd: bestOdd,
      fraction: config.kellyFraction,
      bankroll: config.bankroll,
      cap: config.stakeCap,
    });

    const id = sel.id; // estável: mesmo mercado+seleção
    const prev = previous?.get(id);

    out.push({
      id,
      event: snap.event,
      selection: sel,
      fair,
      books: books.sort((a, b) => b.edge - a.edge),
      bestBook,
      bestOdd,
      bestEdge,
      kellyFraction: k.fraction,
      stake: k.stake,
      // Preserva o "detetado em" se a aposta já existia → mede frescura real.
      detectedAt: prev?.detectedAt ?? now,
      updatedAt: now,
    });
  }

  return out;
}

/**
 * Avalia vários mercados e devolve o feed completo ordenado por edge desc.
 * `previous` permite preservar o detectedAt entre ciclos (atualização
 * incremental, não recriação).
 */
export function evaluateFeed(
  snaps: MarketSnapshot[],
  config: EngineConfig,
  previous?: Map<string, ValueBet>,
): ValueBet[] {
  const all: ValueBet[] = [];
  for (const snap of snaps) {
    all.push(...evaluateMarket(snap, config, previous));
  }
  return all.sort((a, b) => b.bestEdge - a.bestEdge);
}
