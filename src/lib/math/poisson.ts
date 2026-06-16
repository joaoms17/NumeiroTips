/**
 * Modelo Poisson / Dixon-Coles
 * ============================
 *
 * Modelo de contagem para mercados onde a régua sharp cobre mal (cantos,
 * cartões, remates) e também para golos. A ideia: o número de eventos de cada
 * equipa segue aproximadamente uma Poisson com média λ (esperada).
 *
 *   P(k; λ) = e^(−λ) · λ^k / k!
 *
 * Para GOLOS, juntamos as duas equipas numa matriz de resultados e aplicamos a
 * correção de Dixon-Coles (1997), que ajusta os resultados baixos (0-0, 1-0,
 * 0-1, 1-1) — onde a Poisson independente erra mais — via o parâmetro ρ:
 *
 *   τ(x,y) = 1 − λ·μ·ρ   (0,0)
 *          = 1 + λ·ρ     (0,1)
 *          = 1 + μ·ρ     (1,0)
 *          = 1 − ρ       (1,1)
 *          = 1           caso contrário
 *
 *   P(x,y) ∝ Poisson(x; λ) · Poisson(y; μ) · τ(x,y)   (renormalizado)
 *
 * A partir da matriz derivam-se 1X2, ambas marcam e over/under. Para mercados
 * de contagem única (total de cantos, etc.) usa-se a Poisson simples.
 */

/** Probabilidade Poisson P(k; λ). */
export function poissonPmf(k: number, lambda: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0;
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
}

/** P(N ≥ k; λ). */
export function poissonCdfUpper(k: number, lambda: number): number {
  let below = 0;
  for (let i = 0; i < k; i++) below += poissonPmf(i, lambda);
  return Math.max(0, 1 - below);
}

/**
 * Over/Under para um mercado de contagem única (ex.: total de cantos).
 * Linha típica meia (8.5) → não há push. Linha inteira (9) → push possível,
 * devolvido em `push`.
 */
export function countOverUnder(
  lambda: number,
  line: number,
): { over: number; under: number; push: number } {
  // P(N = n) acumulado
  const isHalf = Math.abs(line - Math.round(line)) > 0.001;
  if (isHalf) {
    const threshold = Math.ceil(line); // over se N ≥ threshold
    const over = poissonCdfUpper(threshold, lambda);
    return { over, under: 1 - over, push: 0 };
  }
  const L = Math.round(line);
  const push = poissonPmf(L, lambda);
  const over = poissonCdfUpper(L + 1, lambda);
  return { over, under: 1 - over - push, push };
}

export interface ScoreMatrix {
  /** matrix[x][y] = P(casa marca x, fora marca y). Soma 1. */
  matrix: number[][];
  maxGoals: number;
}

/** τ de Dixon-Coles para os 4 resultados baixos. */
function dcTau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/**
 * Matriz de resultados golos casa × fora, com correção Dixon-Coles.
 * @param lambda golos esperados da casa
 * @param mu golos esperados de fora
 * @param rho parâmetro DC (0 = Poisson independente; típico ≈ −0.1)
 * @param maxGoals truncatura (default 10 cobre praticamente toda a massa)
 */
export function dixonColesMatrix(
  lambda: number,
  mu: number,
  rho = -0.1,
  maxGoals = 10,
): ScoreMatrix {
  const matrix: number[][] = [];
  let sum = 0;
  for (let x = 0; x <= maxGoals; x++) {
    matrix[x] = [];
    for (let y = 0; y <= maxGoals; y++) {
      const p = poissonPmf(x, lambda) * poissonPmf(y, mu) * dcTau(x, y, lambda, mu, rho);
      const safe = p < 0 ? 0 : p; // τ pode ficar levemente negativo em valores extremos
      matrix[x][y] = safe;
      sum += safe;
    }
  }
  // renormaliza (DC + truncatura não somam exatamente 1)
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) matrix[x][y] /= sum;
  }
  return { matrix, maxGoals };
}

export interface MatchProbabilities {
  home: number;
  draw: number;
  away: number;
  bttsYes: number;
  bttsNo: number;
}

/** 1X2 + ambas marcam a partir da matriz de resultados. */
export function matchProbabilities(sm: ScoreMatrix): MatchProbabilities {
  let home = 0;
  let draw = 0;
  let away = 0;
  let bttsYes = 0;
  const { matrix, maxGoals } = sm;
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const p = matrix[x][y];
      if (x > y) home += p;
      else if (x === y) draw += p;
      else away += p;
      if (x >= 1 && y >= 1) bttsYes += p;
    }
  }
  return { home, draw, away, bttsYes, bttsNo: 1 - bttsYes };
}

/** Over/Under de golos totais a partir da matriz. */
export function totalGoalsOverUnder(
  sm: ScoreMatrix,
  line: number,
): { over: number; under: number; push: number } {
  const { matrix, maxGoals } = sm;
  const isHalf = Math.abs(line - Math.round(line)) > 0.001;
  let over = 0;
  let under = 0;
  let push = 0;
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const total = x + y;
      const p = matrix[x][y];
      if (isHalf) {
        if (total > line) over += p;
        else under += p;
      } else {
        if (total > line) over += p;
        else if (total < line) under += p;
        else push += p;
      }
    }
  }
  return { over, under, push };
}

/** Converte uma probabilidade numa odd "justa". */
export function probToOdd(p: number): number {
  return p > 0 ? 1 / p : Infinity;
}

// log(k!) estável para k não muito grande (usa lgamma via série de Stirling).
const LOG_FACT_CACHE: number[] = [0, 0];
function logFactorial(k: number): number {
  if (k < LOG_FACT_CACHE.length) return LOG_FACT_CACHE[k];
  let v = LOG_FACT_CACHE[LOG_FACT_CACHE.length - 1];
  for (let i = LOG_FACT_CACHE.length; i <= k; i++) {
    v += Math.log(i);
    LOG_FACT_CACHE[i] = v;
  }
  return LOG_FACT_CACHE[k];
}
