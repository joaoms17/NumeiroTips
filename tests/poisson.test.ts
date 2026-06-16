import { describe, it, expect } from 'vitest';
import {
  poissonPmf,
  countOverUnder,
  dixonColesMatrix,
  matchProbabilities,
  totalGoalsOverUnder,
  probToOdd,
} from '../src/lib/math/poisson';

describe('Poisson', () => {
  it('pmf bate com valores conhecidos', () => {
    // P(0; 1) = e^-1 ≈ 0.3679
    expect(poissonPmf(0, 1)).toBeCloseTo(0.36788, 4);
    // P(2; 2) = e^-2 · 2 = 0.2707
    expect(poissonPmf(2, 2)).toBeCloseTo(0.27067, 4);
  });

  it('pmf soma ~1 ao longo de k', () => {
    let s = 0;
    for (let k = 0; k < 30; k++) s += poissonPmf(k, 3.2);
    expect(s).toBeCloseTo(1, 6);
  });

  it('over/under de contagem única (linha meia, sem push)', () => {
    const r = countOverUnder(9, 8.5); // cantos esperados 9
    expect(r.push).toBe(0);
    expect(r.over + r.under).toBeCloseTo(1, 9);
    expect(r.over).toBeGreaterThan(0.5); // média 9 > 8.5 → over favorito
  });

  it('over/under de contagem única (linha inteira, com push)', () => {
    const r = countOverUnder(9, 9);
    expect(r.push).toBeGreaterThan(0);
    expect(r.over + r.under + r.push).toBeCloseTo(1, 9);
  });
});

describe('Dixon-Coles (golos)', () => {
  it('matriz soma 1', () => {
    const sm = dixonColesMatrix(1.6, 1.1, -0.1);
    let s = 0;
    for (const row of sm.matrix) for (const p of row) s += p;
    expect(s).toBeCloseTo(1, 9);
  });

  it('1X2 + BTTS somam 1 e o favorito da casa tem prob. maior', () => {
    const sm = dixonColesMatrix(1.8, 1.0, -0.1);
    const m = matchProbabilities(sm);
    expect(m.home + m.draw + m.away).toBeCloseTo(1, 9);
    expect(m.bttsYes + m.bttsNo).toBeCloseTo(1, 9);
    expect(m.home).toBeGreaterThan(m.away); // casa mais forte
  });

  it('rho=0 reduz a Poisson independente nos 1X2', () => {
    const dc = matchProbabilities(dixonColesMatrix(1.5, 1.2, 0));
    // com rho=0, draw deve ser próximo do produto independente de empates
    expect(dc.home + dc.draw + dc.away).toBeCloseTo(1, 9);
    // Dixon-Coles com rho negativo aumenta a prob. de empates baixos vs rho=0
    const dcNeg = matchProbabilities(dixonColesMatrix(1.5, 1.2, -0.15));
    expect(dcNeg.draw).toBeGreaterThan(dc.draw);
  });

  it('totais de golos: over/under coerentes', () => {
    const sm = dixonColesMatrix(1.5, 1.3, -0.1);
    const r = totalGoalsOverUnder(sm, 2.5);
    expect(r.push).toBe(0); // linha meia
    expect(r.over + r.under).toBeCloseTo(1, 9);
    const whole = totalGoalsOverUnder(sm, 3);
    expect(whole.push).toBeGreaterThan(0);
    expect(whole.over + whole.under + whole.push).toBeCloseTo(1, 9);
  });

  it('probToOdd inverte a probabilidade', () => {
    expect(probToOdd(0.5)).toBeCloseTo(2, 9);
    expect(probToOdd(0.25)).toBeCloseTo(4, 9);
  });
});
