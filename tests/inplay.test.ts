import { describe, it, expect } from 'vitest';
import {
  remainingRates,
  liveProbabilities,
  liveTotals,
  DEFAULT_INPLAY_PARAMS,
  type GameState,
} from '../src/lib/math/inplay';
import { dixonColesMatrix } from '../src/lib/math/poisson';

const base = { lambda: 1.6, mu: 1.2 };
const fresh = (p: Partial<GameState> = {}): GameState => ({
  minute: 0,
  homeGoals: 0,
  awayGoals: 0,
  homeReds: 0,
  awayReds: 0,
  ...p,
});

describe('in-play — taxas restantes', () => {
  it('ao minuto 0 sem eventos ≈ expectativa pré-jogo', () => {
    const r = remainingRates(base.lambda, base.mu, fresh());
    expect(r.lambdaRem).toBeCloseTo(1.6, 6);
    expect(r.muRem).toBeCloseTo(1.2, 6);
  });

  it('o tempo que falta reduz proporcionalmente as taxas', () => {
    const r = remainingRates(base.lambda, base.mu, fresh({ minute: 45 }));
    // metade do jogo → metade das taxas (sem ajuste de resultado, 0-0)
    expect(r.lambdaRem).toBeCloseTo(0.8, 6);
    expect(r.muRem).toBeCloseTo(0.6, 6);
  });

  it('quem está a perder ataca mais; quem ganha abranda', () => {
    // casa a perder 0-1 ao minuto 60
    const r = remainingRates(base.lambda, base.mu, fresh({ minute: 60, awayGoals: 1 }));
    const neutral = remainingRates(base.lambda, base.mu, fresh({ minute: 60 }));
    expect(r.lambdaRem).toBeGreaterThan(neutral.lambdaRem); // casa empurra
    expect(r.muRem).toBeLessThan(neutral.muRem); // fora gere o resultado
  });

  it('expulsão própria reduz a taxa e aumenta a do adversário', () => {
    const r = remainingRates(base.lambda, base.mu, fresh({ minute: 30, homeReds: 1 }));
    const neutral = remainingRates(base.lambda, base.mu, fresh({ minute: 30 }));
    expect(r.lambdaRem).toBeLessThan(neutral.lambdaRem);
    expect(r.muRem).toBeGreaterThan(neutral.muRem);
  });
});

describe('in-play — probabilidades ao vivo', () => {
  it('1X2 + BTTS somam 1', () => {
    const p = liveProbabilities(base.lambda, base.mu, fresh({ minute: 70, homeGoals: 1 }));
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 6);
    expect(p.bttsYes + p.bttsNo).toBeCloseTo(1, 6);
  });

  it('a liderar tarde → prob. de vitória muito alta', () => {
    const p = liveProbabilities(base.lambda, base.mu, fresh({ minute: 88, homeGoals: 2, awayGoals: 0 }));
    expect(p.home).toBeGreaterThan(0.9);
  });

  it('próximo golo: casa+fora+nenhum somam 1 e favorecem quem tem maior taxa', () => {
    const p = liveProbabilities(base.lambda, base.mu, fresh({ minute: 50 }));
    expect(p.nextGoalHome + p.nextGoalAway + p.nextGoalNone).toBeCloseTo(1, 6);
    expect(p.nextGoalHome).toBeGreaterThan(p.nextGoalAway); // casa com λ maior
  });

  it('jogo praticamente acabado → quase sem mais golos', () => {
    const p = liveProbabilities(base.lambda, base.mu, fresh({ minute: 90, homeGoals: 1, awayGoals: 1 }));
    expect(p.draw).toBeGreaterThan(0.95); // empate quase certo
    expect(p.nextGoalNone).toBeGreaterThan(0.95);
  });
});

describe('in-play — over/under ao vivo', () => {
  it('inclui os golos já marcados', () => {
    const state = fresh({ minute: 30, homeGoals: 2, awayGoals: 1 }); // já 3 golos
    const rates = remainingRates(base.lambda, base.mu, state);
    const sm = dixonColesMatrix(rates.lambdaRem, rates.muRem, DEFAULT_INPLAY_PARAMS.rho, 8);
    const r = liveTotals(sm, state, 2.5);
    // já há 3 golos > 2.5 → over é certo
    expect(r.over).toBeCloseTo(1, 6);
    expect(r.under).toBeCloseTo(0, 6);
  });

  it('over/under coerente a meio com 1 golo', () => {
    const state = fresh({ minute: 30, homeGoals: 1 });
    const rates = remainingRates(base.lambda, base.mu, state);
    const sm = dixonColesMatrix(rates.lambdaRem, rates.muRem, DEFAULT_INPLAY_PARAMS.rho, 8);
    const r = liveTotals(sm, state, 2.5);
    expect(r.over + r.under).toBeCloseTo(1, 6);
    expect(r.over).toBeGreaterThan(0);
    expect(r.over).toBeLessThan(1);
  });
});
