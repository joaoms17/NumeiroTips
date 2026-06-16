/**
 * De-vigging (remoção da margem do bookmaker)
 * ============================================
 *
 * Um bookmaker cota odds cujas probabilidades implícitas (p = 1/odd) somam
 * MAIS do que 1. Esse excesso é a margem ("vig"/"overround"):
 *
 *     booksum  B = Σ (1/odd_i)        →  B > 1
 *     margem     = B − 1
 *
 * Para obter a probabilidade "justa" temos de remover a margem. Implementamos
 * dois métodos:
 *
 *  1. PROPORCIONAL (multiplicativo) — fallback simples e robusto:
 *         p_i = (1/odd_i) / B
 *     Distribui a margem proporcionalmente ao preço. Rápido e estável, mas
 *     sabe-se que sobrestima a probabilidade dos favoritos (favourite-longshot
 *     bias) porque o bookmaker não aplica a margem de forma uniforme.
 *
 *  2. SHIN (1992/1993) — método preferido para réguas sharp:
 *     Modela a margem como resultado de uma fração `z` de apostadores
 *     "insiders" (informados). Corrige o viés favorito-azarão melhor que o
 *     proporcional e é o standard na literatura de quantificação de odds
 *     (ver Štrumbelj 2014, "On determining probability forecasts from betting
 *     odds"). A probabilidade verdadeira de cada resultado é:
 *
 *         p_i(z) = ( √( z² + 4(1−z)·π_i²/B ) − z ) / ( 2(1−z) )
 *
 *     onde π_i = 1/odd_i e B = Σ π_i. O parâmetro z ∈ [0,1) é escolhido de
 *     forma a que Σ p_i(z) = 1. Resolvemos z por bisseção (a soma é monótona
 *     decrescente em z neste intervalo, garantindo raiz única).
 *
 * Ambos devolvem probabilidades normalizadas (somam exatamente 1) e a
 * respetiva "odd justa" = 1 / p_i.
 */

export type DevigMethod = 'shin' | 'proportional';

export interface FairOutcome {
  /** Probabilidade verdadeira estimada (0..1), normalizada. */
  prob: number;
  /** Odd decimal justa = 1 / prob. */
  fairOdd: number;
}

export interface DevigResult {
  method: DevigMethod;
  /** Soma das probabilidades implícitas brutas (= 1 + margem). */
  booksum: number;
  /** Margem do bookmaker (overround), B − 1. */
  margin: number;
  /** Proporção de insiders estimada pelo modelo de Shin (0 para proporcional). */
  z: number;
  outcomes: FairOutcome[];
}

const EPS = 1e-12;

/** Probabilidades implícitas brutas a partir de odds decimais. */
export function impliedProbabilities(odds: number[]): number[] {
  return odds.map((o) => {
    if (!(o > 1)) {
      throw new RangeError(`Odd decimal inválida: ${o} (tem de ser > 1)`);
    }
    return 1 / o;
  });
}

/** Soma das probabilidades implícitas (booksum). */
export function booksum(odds: number[]): number {
  return impliedProbabilities(odds).reduce((a, b) => a + b, 0);
}

/** De-vig proporcional (multiplicativo). */
export function devigProportional(odds: number[]): DevigResult {
  const pi = impliedProbabilities(odds);
  const B = pi.reduce((a, b) => a + b, 0);
  const outcomes = pi.map((p) => {
    const prob = p / B;
    return { prob, fairOdd: 1 / prob };
  });
  return { method: 'proportional', booksum: B, margin: B - 1, z: 0, outcomes };
}

/** p_i(z) do modelo de Shin para um dado z. */
function shinProb(piNorm2OverB: number, z: number): number {
  // piNorm2OverB = π_i² / B  (pré-calculado)
  const inside = z * z + 4 * (1 - z) * piNorm2OverB;
  return (Math.sqrt(inside) - z) / (2 * (1 - z));
}

/**
 * De-vig de Shin. Resolve z por bisseção em [0, 1).
 *
 * Em z=0 a soma das p_i é √B (> 1 para margem positiva); à medida que z cresce
 * a soma decresce monotonicamente abaixo de 1, logo existe z único com soma=1.
 */
export function devigShin(odds: number[], maxIter = 100, tol = 1e-12): DevigResult {
  const pi = impliedProbabilities(odds);
  const B = pi.reduce((a, b) => a + b, 0);

  // Sem margem (ou enviesada para baixo) → não há nada a remover.
  if (B <= 1 + EPS) {
    const outcomes = pi.map((p) => ({ prob: p, fairOdd: p > 0 ? 1 / p : Infinity }));
    return { method: 'shin', booksum: B, margin: B - 1, z: 0, outcomes };
  }

  const c = pi.map((p) => (p * p) / B); // π_i² / B

  const sumAt = (z: number): number =>
    c.reduce((acc, ci) => acc + shinProb(ci, z), 0);

  // Bisseção: f(z) = sumAt(z) - 1. f(0) > 0, f(1⁻) < 0.
  let lo = 0;
  let hi = 1 - 1e-9;
  let z = 0;
  for (let i = 0; i < maxIter; i++) {
    z = (lo + hi) / 2;
    const f = sumAt(z) - 1;
    if (Math.abs(f) < tol) break;
    if (f > 0) lo = z;
    else hi = z;
  }

  const raw = c.map((ci) => shinProb(ci, z));
  const s = raw.reduce((a, b) => a + b, 0);
  // Renormaliza para limpar erro numérico residual.
  const outcomes = raw.map((p) => {
    const prob = p / s;
    return { prob, fairOdd: 1 / prob };
  });

  return { method: 'shin', booksum: B, margin: B - 1, z, outcomes };
}

/**
 * De-vig com o método escolhido. Se Shin falhar (ex.: 1 só resultado, dados
 * degenerados), cai para o proporcional.
 */
export function devig(odds: number[], method: DevigMethod = 'shin'): DevigResult {
  if (odds.length < 2 || method === 'proportional') {
    // Shin precisa de ≥ 2 resultados; com 1 só faz sentido proporcional.
    return devigProportional(odds);
  }
  try {
    const r = devigShin(odds);
    if (r.outcomes.some((o) => !Number.isFinite(o.prob) || o.prob <= 0)) {
      return devigProportional(odds);
    }
    return r;
  } catch {
    return devigProportional(odds);
  }
}
