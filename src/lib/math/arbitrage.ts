/**
 * Arbitragem ("surebets")
 * =======================
 *
 * Numa arbitragem cobrimos TODOS os resultados de um mercado em casas
 * diferentes, a odds tais que o retorno é garantido independentemente do
 * resultado. Para um mercado com resultados mutuamente exclusivos e exaustivos,
 * usando a MELHOR odd disponível por resultado:
 *
 *     S = Σ (1 / melhor_odd_i)
 *
 *   - S < 1  → existe arbitragem; margem garantida = (1/S) − 1
 *   - S ≥ 1  → não há arbitragem (o normal)
 *
 * Distribuição de stakes para um total T que iguala o retorno em todos os
 * resultados:
 *
 *     stake_i = T · (1/melhor_odd_i) / S     →  retorno = T / S  (em qualquer caso)
 *
 * No NumeiroTips procuramos arbitragem ENTRE as casas-alvo (Betclic, 1xBet) e,
 * opcionalmente, contra a Betfair Exchange. É raro e fecha depressa, mas quando
 * aparece é lucro sem risco de mercado (resta o risco de conta/limitação).
 */

export interface ArbQuote {
  /** Id da casa (ex.: 'betclic', '1xbet', 'betfair'). */
  book: string;
  odd: number;
}

export interface ArbOutcome {
  selectionId: string;
  label: string;
  /** Cotações desta seleção nas casas consideradas. */
  quotes: ArbQuote[];
}

export interface ArbLeg {
  selectionId: string;
  label: string;
  book: string;
  odd: number;
  /** Fração do stake total a colocar nesta perna. */
  stakeFraction: number;
  /** Stake em € se um total foi fornecido. */
  stake: number | null;
}

export interface ArbResult {
  isArb: boolean;
  /** Σ(1/melhor_odd). < 1 ⇒ arbitragem. */
  bookSum: number;
  /** Margem garantida = (1/bookSum) − 1 (pode ser negativa se não há arb). */
  margin: number;
  legs: ArbLeg[];
  /** Retorno garantido (€) se um total foi fornecido. */
  guaranteedReturn: number | null;
}

/**
 * Calcula a arbitragem de um mercado, escolhendo a melhor odd por resultado.
 * @param outcomes resultados do mercado (cada um com cotações por casa)
 * @param totalStake total a distribuir (€), opcional
 */
export function findArbitrage(outcomes: ArbOutcome[], totalStake?: number): ArbResult {
  if (outcomes.length < 2) {
    return { isArb: false, bookSum: Infinity, margin: -Infinity, legs: [], guaranteedReturn: null };
  }

  // melhor odd por resultado
  const best = outcomes.map((o) => {
    const top = o.quotes.reduce<ArbQuote | null>((acc, q) => {
      if (!(q.odd > 1)) return acc;
      return acc == null || q.odd > acc.odd ? q : acc;
    }, null);
    return { outcome: o, best: top };
  });

  // se algum resultado não tem cotação válida, não dá para cobrir tudo
  if (best.some((b) => b.best == null)) {
    return { isArb: false, bookSum: Infinity, margin: -Infinity, legs: [], guaranteedReturn: null };
  }

  const bookSum = best.reduce((s, b) => s + 1 / b.best!.odd, 0);
  const margin = 1 / bookSum - 1;
  const isArb = bookSum < 1;

  const legs: ArbLeg[] = best.map((b) => {
    const frac = 1 / b.best!.odd / bookSum;
    return {
      selectionId: b.outcome.selectionId,
      label: b.outcome.label,
      book: b.best!.book,
      odd: b.best!.odd,
      stakeFraction: frac,
      stake: totalStake != null ? round2(frac * totalStake) : null,
    };
  });

  const guaranteedReturn = totalStake != null ? round2(totalStake / bookSum) : null;

  return { isArb, bookSum, margin, legs, guaranteedReturn };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
