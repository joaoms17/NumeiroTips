/**
 * Valor esperado (Expected Value) e edge (+EV)
 * ============================================
 *
 * Dada a probabilidade "justa" `p` (estimada da régua sharp via de-vig) e a
 * odd decimal que a casa-alvo paga `oddHouse`, o valor esperado por unidade
 * apostada é:
 *
 *     EV = p · (oddHouse − 1) − (1 − p) · 1
 *        = p · oddHouse − 1
 *
 * Interpretação: por cada 1€ apostado, esperamos EV€ de lucro a longo prazo.
 *   EV > 0  →  aposta de valor (+EV)
 *   EV = 0  →  neutra (a casa paga exatamente o justo)
 *   EV < 0  →  −EV (a casa fica com margem; o caso normal)
 *
 * "edge" é sinónimo de EV por unidade neste contexto. Sinalizamos uma aposta
 * quando edge ≥ limiar (default 2%).
 */

/** EV por unidade apostada = p · oddHouse − 1. */
export function expectedValue(fairProb: number, oddHouse: number): number {
  return fairProb * oddHouse - 1;
}

/** Alias semântico — o "edge" é o EV por unidade. */
export const edge = expectedValue;

/** True se a aposta cumpre o limiar de edge (default 2%). */
export function isValueBet(fairProb: number, oddHouse: number, threshold = 0.02): boolean {
  return expectedValue(fairProb, oddHouse) >= threshold;
}

export interface BookQuote {
  /** Identificador da casa (ex.: 'betclic', '1xbet'). */
  book: string;
  /** Odd decimal cotada pela casa-alvo. */
  odd: number;
}

export interface LineShopResult {
  /** Melhor casa (odd mais alta entre as +EV). */
  bestBook: string;
  bestOdd: number;
  bestEdge: number;
  /** Edge calculado para cada casa, ordenado por edge desc. */
  perBook: Array<{ book: string; odd: number; edge: number; isValue: boolean }>;
}

/**
 * Line shopping entre casas-alvo (Betclic vs 1xBet): calcula o edge de cada
 * uma contra a MESMA probabilidade justa e recomenda a de odd mais alta de
 * entre as que são +EV. Se nenhuma for +EV, devolve mesmo assim a melhor.
 */
export function lineShop(
  fairProb: number,
  quotes: BookQuote[],
  threshold = 0.02,
): LineShopResult {
  if (quotes.length === 0) {
    throw new RangeError('lineShop precisa de pelo menos uma cotação');
  }
  const perBook = quotes
    .map((q) => ({
      book: q.book,
      odd: q.odd,
      edge: expectedValue(fairProb, q.odd),
      isValue: expectedValue(fairProb, q.odd) >= threshold,
    }))
    .sort((a, b) => b.edge - a.edge);

  // Entre as +EV, recomenda a de odd mais alta (maximiza o retorno por aposta).
  const valueOnes = perBook.filter((p) => p.isValue);
  const pool = valueOnes.length > 0 ? valueOnes : perBook;
  const best = pool.reduce((acc, p) => (p.odd > acc.odd ? p : acc), pool[0]);

  return {
    bestBook: best.book,
    bestOdd: best.odd,
    bestEdge: best.edge,
    perBook,
  };
}
