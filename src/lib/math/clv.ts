/**
 * Closing Line Value (CLV)
 * ========================
 *
 * O CLV mede se apostámos a uma odd melhor do que a "linha de fecho" sharp
 * (a odd justa no momento em que o mercado fecha). É a métrica mais fiável de
 * skill a longo prazo: bater consistentemente a linha de fecho prevê lucro.
 *
 *     CLV = (odd_apostada / odd_fecho_sharp_sem_margem) − 1
 *
 * onde `odd_fecho_sharp_sem_margem` é a odd JUSTA (já de-vigged) derivada do
 * preço sharp no fecho do mercado. CLV > 0 significa que conseguimos preço
 * acima do justo final → +EV confirmado pelo próprio mercado.
 */

/**
 * CLV a partir da odd apostada e da odd justa de fecho (já sem margem).
 * @param oddBet odd decimal a que a aposta foi colocada
 * @param fairClosingOdd odd justa (de-vigged) sharp no fecho
 */
export function clv(oddBet: number, fairClosingOdd: number): number {
  if (!(fairClosingOdd > 0)) {
    throw new RangeError('fairClosingOdd tem de ser > 0');
  }
  return oddBet / fairClosingOdd - 1;
}

/**
 * CLV em termos de probabilidade (equivalente, por vezes mais intuitivo):
 * compara a prob. implícita da nossa odd com a prob. justa de fecho.
 *   beat = prob_justa_fecho − prob_implícita_aposta
 * Positivo = apostámos a uma prob. implícita menor que a justa → valor.
 */
export function clvProbEdge(oddBet: number, fairClosingProb: number): number {
  return fairClosingProb - 1 / oddBet;
}
