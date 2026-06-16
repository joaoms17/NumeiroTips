import { describe, it, expect } from 'vitest';
import { findArbitrage, type ArbOutcome } from '../src/lib/math/arbitrage';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('arbitragem', () => {
  it('deteta arbitragem quando Σ(1/melhor_odd) < 1', () => {
    // 1X2 com odds altas espalhadas por casas → arb
    const outcomes: ArbOutcome[] = [
      { selectionId: 'h', label: 'Casa', quotes: [{ book: 'betclic', odd: 2.6 }, { book: '1xbet', odd: 2.5 }] },
      { selectionId: 'd', label: 'Empate', quotes: [{ book: 'betclic', odd: 3.8 }, { book: '1xbet', odd: 4.0 }] },
      { selectionId: 'a', label: 'Fora', quotes: [{ book: 'betclic', odd: 3.5 }, { book: '1xbet', odd: 3.9 }] },
    ];
    const r = findArbitrage(outcomes, 100);
    // melhores: 2.6 / 4.0 / 3.9 → S = 0.3846+0.25+0.2564 = 0.8910 < 1
    expect(r.bookSum).toBeCloseTo(0.891, 2);
    expect(r.isArb).toBe(true);
    expect(r.margin).toBeGreaterThan(0);
    // escolhe a melhor casa por perna
    expect(r.legs.find((l) => l.selectionId === 'h')!.book).toBe('betclic');
    expect(r.legs.find((l) => l.selectionId === 'd')!.book).toBe('1xbet');
  });

  it('stakes garantem o mesmo retorno em qualquer resultado', () => {
    const outcomes: ArbOutcome[] = [
      { selectionId: 'h', label: 'Casa', quotes: [{ book: 'a', odd: 2.6 }] },
      { selectionId: 'd', label: 'X', quotes: [{ book: 'b', odd: 4.0 }] },
      { selectionId: 'a', label: 'Fora', quotes: [{ book: 'c', odd: 3.9 }] },
    ];
    const r = findArbitrage(outcomes, 100);
    // retorno por perna = stake_i * odd_i deve ser igual ao retorno garantido
    for (const leg of r.legs) {
      expect(leg.stake! * leg.odd).toBeCloseTo(r.guaranteedReturn!, 1);
    }
    // stakes somam o total
    expect(sum(r.legs.map((l) => l.stake!))).toBeCloseTo(100, 1);
  });

  it('mercado normal (com margem) → sem arbitragem', () => {
    const outcomes: ArbOutcome[] = [
      { selectionId: 'h', label: 'Casa', quotes: [{ book: 'a', odd: 1.9 }] },
      { selectionId: 'd', label: 'X', quotes: [{ book: 'b', odd: 3.3 }] },
      { selectionId: 'a', label: 'Fora', quotes: [{ book: 'c', odd: 3.6 }] },
    ];
    const r = findArbitrage(outcomes, 100);
    expect(r.isArb).toBe(false);
    expect(r.bookSum).toBeGreaterThan(1);
    expect(r.margin).toBeLessThan(0);
  });

  it('resultado sem cotação válida → não há arbitragem', () => {
    const outcomes: ArbOutcome[] = [
      { selectionId: 'h', label: 'Casa', quotes: [{ book: 'a', odd: 2.6 }] },
      { selectionId: 'd', label: 'X', quotes: [] }, // sem cotação
      { selectionId: 'a', label: 'Fora', quotes: [{ book: 'c', odd: 3.9 }] },
    ];
    expect(findArbitrage(outcomes, 100).isArb).toBe(false);
  });
});
