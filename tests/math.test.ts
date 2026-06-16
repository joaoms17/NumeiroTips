import { describe, it, expect } from 'vitest';
import {
  impliedProbabilities,
  booksum,
  devigProportional,
  devigShin,
  devig,
  expectedValue,
  isValueBet,
  lineShop,
  fullKellyFraction,
  kelly,
  discreetStake,
  clv,
  clvProbEdge,
} from '../src/lib/math';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('implícitas e booksum', () => {
  it('p = 1/odd', () => {
    expect(impliedProbabilities([2])).toEqual([0.5]);
  });
  it('booksum soma as implícitas (com margem)', () => {
    // 1.90 / 1.90 → 0.5263 * 2 ≈ 1.0526 (margem ~5.3%)
    expect(booksum([1.9, 1.9])).toBeCloseTo(1.0526, 3);
  });
  it('rejeita odds <= 1', () => {
    expect(() => impliedProbabilities([1])).toThrow();
    expect(() => impliedProbabilities([0.5])).toThrow();
  });
});

describe('de-vig proporcional', () => {
  it('probabilidades somam 1', () => {
    const r = devigProportional([1.9, 1.9]);
    expect(sum(r.outcomes.map((o) => o.prob))).toBeCloseTo(1, 10);
  });
  it('mercado simétrico → 50/50', () => {
    const r = devigProportional([1.9, 1.9]);
    expect(r.outcomes[0].prob).toBeCloseTo(0.5, 10);
    expect(r.outcomes[0].fairOdd).toBeCloseTo(2, 10);
  });
  it('margem reportada corretamente', () => {
    const r = devigProportional([1.9, 1.9]);
    expect(r.margin).toBeCloseTo(0.0526, 3);
  });
});

describe('de-vig de Shin', () => {
  it('probabilidades somam 1', () => {
    const r = devigShin([2.1, 3.4, 3.9]); // 1X2 típico
    expect(sum(r.outcomes.map((o) => o.prob))).toBeCloseTo(1, 8);
  });

  it('mercado simétrico → 50/50 e z pequeno', () => {
    const r = devigShin([1.9, 1.9]);
    expect(r.outcomes[0].prob).toBeCloseTo(0.5, 6);
    expect(r.outcomes[1].prob).toBeCloseTo(0.5, 6);
    expect(r.z).toBeGreaterThanOrEqual(0);
    expect(r.z).toBeLessThan(1);
  });

  it('corrige o viés favorito-azarão na direção certa', () => {
    const odds = [1.3, 6.0, 11.0]; // favorito forte + azarões
    const prop = devigProportional(odds);
    const shin = devigShin(odds);
    // Shin assume insiders → atribui ao FAVORITO prob. justa MAIOR que o
    // proporcional, e aos AZARÕES (longshots) prob. MENOR. É exatamente a
    // correção do favourite-longshot bias documentada na literatura.
    expect(shin.outcomes[0].prob).toBeGreaterThan(prop.outcomes[0].prob); // favorito
    expect(shin.outcomes[2].prob).toBeLessThan(prop.outcomes[2].prob); // azarão
    // E continua a somar 1.
    expect(sum(shin.outcomes.map((o) => o.prob))).toBeCloseTo(1, 8);
  });

  it('sem margem (booksum<=1) devolve as implícitas', () => {
    // odds de exchange já "justas": 2.0 / 2.0 → booksum 1.0
    const r = devigShin([2.0, 2.0]);
    expect(r.margin).toBeCloseTo(0, 6);
    expect(r.outcomes[0].prob).toBeCloseTo(0.5, 6);
  });

  it('fairOdd = 1/prob', () => {
    const r = devigShin([2.1, 3.4, 3.9]);
    for (const o of r.outcomes) {
      expect(o.fairOdd).toBeCloseTo(1 / o.prob, 10);
    }
  });
});

describe('devig dispatcher e fallback', () => {
  it('1 só resultado → proporcional', () => {
    const r = devig([1.5], 'shin');
    expect(r.method).toBe('proportional');
  });
  it('método proporcional explícito', () => {
    expect(devig([1.9, 1.9], 'proportional').method).toBe('proportional');
  });
});

describe('EV / edge', () => {
  it('EV = p·odd − 1', () => {
    expect(expectedValue(0.5, 2.1)).toBeCloseTo(0.05, 10); // 5% edge
  });
  it('odd justa → EV 0', () => {
    expect(expectedValue(0.5, 2.0)).toBeCloseTo(0, 10);
  });
  it('isValueBet respeita o limiar', () => {
    expect(isValueBet(0.5, 2.1, 0.02)).toBe(true); // 5% >= 2%
    expect(isValueBet(0.5, 2.02, 0.02)).toBe(false); // 1% < 2%
  });
});

describe('line shopping Betclic vs 1xBet', () => {
  it('recomenda a odd mais alta entre as +EV', () => {
    const fair = 0.5; // odd justa 2.0
    const r = lineShop(fair, [
      { book: 'betclic', odd: 2.05 },
      { book: '1xbet', odd: 2.12 },
    ]);
    expect(r.bestBook).toBe('1xbet');
    expect(r.bestOdd).toBe(2.12);
    expect(r.perBook[0].edge).toBeGreaterThan(r.perBook[1].edge);
  });
  it('ordena perBook por edge desc', () => {
    const r = lineShop(0.5, [
      { book: 'betclic', odd: 2.2 },
      { book: '1xbet', odd: 2.05 },
    ]);
    expect(r.perBook[0].book).toBe('betclic');
  });
  it('se nenhuma é +EV, devolve mesmo assim a melhor odd', () => {
    const r = lineShop(0.5, [
      { book: 'betclic', odd: 1.95 },
      { book: '1xbet', odd: 1.98 },
    ]);
    expect(r.bestBook).toBe('1xbet');
    expect(r.perBook.every((p) => !p.isValue)).toBe(true);
  });
});

describe('Kelly', () => {
  it('f* = (b·p − q)/b', () => {
    // p=0.55, odd=2.0 → b=1, q=0.45 → f*=0.10
    expect(fullKellyFraction(0.55, 2.0)).toBeCloseTo(0.1, 10);
  });
  it('aposta −EV → 0 (nunca negativo)', () => {
    expect(fullKellyFraction(0.45, 2.0)).toBe(0);
  });
  it('¼ Kelly e stake sobre a banca', () => {
    const r = kelly({ prob: 0.55, odd: 2.0, fraction: 0.25, bankroll: 1000 });
    expect(r.fullKelly).toBeCloseTo(0.1, 10);
    expect(r.fraction).toBeCloseTo(0.025, 10); // 10% * 1/4
    expect(r.stake).toBeCloseTo(25, 6); // 2.5% de 1000
    expect(r.positive).toBe(true);
  });
  it('teto (cap) limita a fração', () => {
    const r = kelly({ prob: 0.8, odd: 2.0, fraction: 1, bankroll: 1000, cap: 0.05 });
    expect(r.fraction).toBe(0.05);
    expect(r.stake).toBeCloseTo(50, 6);
  });
  it('stake discreto arredonda para passo natural', () => {
    expect(discreetStake(4.83, 0.5)).toBe(5);
    expect(discreetStake(0.1, 0.5)).toBe(0.5);
    expect(discreetStake(0, 0.5)).toBe(0);
  });
});

describe('CLV', () => {
  it('apostar acima do justo de fecho → CLV positivo', () => {
    // apostámos a 2.10, fecho justo 2.00 → CLV = 5%
    expect(clv(2.1, 2.0)).toBeCloseTo(0.05, 10);
  });
  it('apostar abaixo do justo de fecho → CLV negativo', () => {
    expect(clv(1.95, 2.0)).toBeCloseTo(-0.025, 10);
  });
  it('clvProbEdge coerente com o sinal', () => {
    // odd 2.10 → prob implícita 0.476; fecho justo 0.5 → edge +0.0238
    expect(clvProbEdge(2.1, 0.5)).toBeCloseTo(0.0238, 4);
  });
});
