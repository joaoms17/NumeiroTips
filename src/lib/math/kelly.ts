/**
 * Critério de Kelly (gestão de stake)
 * ===================================
 *
 * O critério de Kelly maximiza a taxa de crescimento geométrico da banca a
 * longo prazo. Para uma aposta com odd decimal `odd` e probabilidade `p`:
 *
 *     b = odd − 1            (ganho líquido por unidade se ganhar)
 *     q = 1 − p             (probabilidade de perder)
 *     f* = (b·p − q) / b    (fração ÓTIMA da banca a apostar)
 *
 * Notas práticas implementadas:
 *  - f* < 0 significa aposta −EV → nunca apostar (clamp a 0).
 *  - Kelly cheio é volátil e assume p perfeito. Como as nossas estimativas têm
 *    erro, usamos Kelly FRACIONÁRIO (default ¼): stake = fração · f* · banca.
 *  - Limitamos opcionalmente a um teto de % da banca por aposta (segurança e
 *    para manter stakes discretos perante casas que limitam vencedores).
 */

export interface KellyInput {
  /** Probabilidade justa estimada (0..1). */
  prob: number;
  /** Odd decimal da casa onde se aposta. */
  odd: number;
  /** Fração de Kelly a aplicar (default 0.25 = ¼ Kelly). */
  fraction?: number;
  /** Banca total disponível (€). Se omitida, devolve só frações. */
  bankroll?: number;
  /** Teto opcional de fração da banca por aposta (ex.: 0.02 = 2%). */
  cap?: number;
}

export interface KellyResult {
  /** Fração ótima de Kelly cheio (já com clamp ≥ 0). */
  fullKelly: number;
  /** Fração efetiva após aplicar a fração escolhida e o teto. */
  fraction: number;
  /** Stake recomendado (€) se a banca foi fornecida, senão null. */
  stake: number | null;
  /** True se a aposta é +EV (fullKelly > 0). */
  positive: boolean;
}

/** Fração de Kelly cheio f* = (b·p − q)/b, com clamp em [0, 1]. */
export function fullKellyFraction(prob: number, odd: number): number {
  if (!(odd > 1)) return 0;
  const b = odd - 1;
  const p = clamp01(prob);
  const q = 1 - p;
  const f = (b * p - q) / b;
  if (!Number.isFinite(f) || f <= 0) return 0;
  return Math.min(f, 1);
}

export function kelly(input: KellyInput): KellyResult {
  const { prob, odd, fraction = 0.25, bankroll, cap } = input;
  const fullKelly = fullKellyFraction(prob, odd);
  let frac = fullKelly * fraction;
  if (cap != null) frac = Math.min(frac, cap);
  const stake = bankroll != null ? round2(frac * bankroll) : null;
  return {
    fullKelly,
    fraction: frac,
    stake,
    positive: fullKelly > 0,
  };
}

/**
 * Arredonda o stake para um valor "discreto" e natural, de forma a não
 * levantar bandeiras nas casas que limitam vencedores (ex.: 4.83€ → 5€).
 * Usa um passo configurável (default 0.50€) e nunca devolve negativo.
 */
export function discreetStake(stake: number, step = 0.5): number {
  if (stake <= 0) return 0;
  return Math.max(step, Math.round(stake / step) * step);
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
