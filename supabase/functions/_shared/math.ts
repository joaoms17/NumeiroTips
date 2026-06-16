/**
 * Motor matemático — versão Deno para Edge Functions.
 * Espelha src/lib/math (mantém as duas em sincronia). Documentação completa em
 * src/lib/math/*. Aqui fica o essencial: de-vig Shin/proporcional, EV e Kelly.
 */

export type DevigMethod = "shin" | "proportional";

export interface FairOutcome {
  prob: number;
  fairOdd: number;
}

export function impliedProbabilities(odds: number[]): number[] {
  return odds.map((o) => {
    if (!(o > 1)) throw new RangeError(`Odd inválida: ${o}`);
    return 1 / o;
  });
}

export function devigProportional(odds: number[]): FairOutcome[] {
  const pi = impliedProbabilities(odds);
  const B = pi.reduce((a, b) => a + b, 0);
  return pi.map((p) => {
    const prob = p / B;
    return { prob, fairOdd: 1 / prob };
  });
}

function shinProb(piNorm2OverB: number, z: number): number {
  const inside = z * z + 4 * (1 - z) * piNorm2OverB;
  return (Math.sqrt(inside) - z) / (2 * (1 - z));
}

export function devigShin(odds: number[], maxIter = 100, tol = 1e-12): FairOutcome[] {
  const pi = impliedProbabilities(odds);
  const B = pi.reduce((a, b) => a + b, 0);
  if (B <= 1 + 1e-12) return pi.map((p) => ({ prob: p, fairOdd: 1 / p }));

  const c = pi.map((p) => (p * p) / B);
  const sumAt = (z: number) => c.reduce((acc, ci) => acc + shinProb(ci, z), 0);

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
  return raw.map((p) => {
    const prob = p / s;
    return { prob, fairOdd: 1 / prob };
  });
}

export function devig(odds: number[], method: DevigMethod = "shin"): FairOutcome[] {
  if (odds.length < 2 || method === "proportional") return devigProportional(odds);
  try {
    const r = devigShin(odds);
    if (r.some((o) => !Number.isFinite(o.prob) || o.prob <= 0)) return devigProportional(odds);
    return r;
  } catch {
    return devigProportional(odds);
  }
}

export function expectedValue(fairProb: number, oddHouse: number): number {
  return fairProb * oddHouse - 1;
}

export function fullKellyFraction(prob: number, odd: number): number {
  if (!(odd > 1)) return 0;
  const b = odd - 1;
  const p = Math.max(0, Math.min(1, prob));
  const f = (b * p - (1 - p)) / b;
  return !Number.isFinite(f) || f <= 0 ? 0 : Math.min(f, 1);
}

export function kellyStake(
  prob: number,
  odd: number,
  fraction: number,
  bankroll: number,
  cap?: number,
): { fraction: number; stake: number } {
  let frac = fullKellyFraction(prob, odd) * fraction;
  if (cap != null) frac = Math.min(frac, cap);
  return { fraction: frac, stake: Math.round(frac * bankroll * 100) / 100 };
}
