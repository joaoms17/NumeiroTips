import { describe, it, expect } from 'vitest';
import { normalizeFixtureOdds, type OddsPapiOddsResponse } from '../src/data/oddsPapiNormalize';

/**
 * Estes testes validam a TRAVESSIA da estrutura documentada da OddsPapi
 * (`bookmakerOdds[bk].markets[id].outcomes`) e o mapeamento para MarketSnapshot.
 * Usam um exemplo no formato documentado. Quando tiveres um exemplo REAL,
 * substitui o `sample` abaixo — se os nomes dos campos diferirem, ajusta os
 * mapeamentos em oddsPapiNormalize.ts (BOOKMAKER_SLUGS / mapMarket / readOutcome).
 */
const fixture = {
  id: 'fx_1',
  league: { name: 'Premier League' },
  homeTeam: { name: 'Arsenal' },
  awayTeam: { name: 'Chelsea' },
  startTime: '2026-06-20T19:00:00Z',
};

const sample: OddsPapiOddsResponse = {
  fixtureId: 'fx_1',
  bookmakerOdds: {
    pinnacle: {
      markets: {
        '1x2': {
          type: '1x2',
          outcomes: [
            { name: '1', price: 2.0 },
            { name: 'X', price: 3.6 },
            { name: '2', price: 4.0 },
          ],
        },
        totals_2_5: {
          type: 'totals',
          line: 2.5,
          outcomes: [
            { name: 'Over', price: 1.95, line: 2.5 },
            { name: 'Under', price: 1.9, line: 2.5 },
          ],
        },
      },
    },
    betclic: {
      markets: {
        '1x2': {
          type: '1x2',
          outcomes: [
            { name: '1', price: 2.2 }, // acima do justo → +EV
            { name: 'X', price: 3.4 },
            { name: '2', price: 3.7 },
          ],
        },
      },
    },
    '1xbet': {
      markets: {
        '1x2': {
          type: '1x2',
          outcomes: [
            { name: 'Home', price: 2.05 },
            { name: 'Draw', price: 3.5 },
            { name: 'Away', price: 3.8 },
          ],
        },
      },
    },
  },
};

describe('normalização OddsPapi', () => {
  const snaps = normalizeFixtureOdds(fixture, sample);

  it('produz um snapshot por mercado suportado (1x2 + over_under)', () => {
    const types = snaps.map((s) => s.market).sort();
    expect(types).toEqual(['1x2', 'over_under']);
  });

  it('o snapshot 1x2 tem 3 seleções com ids estáveis', () => {
    const m1x2 = snaps.find((s) => s.market === '1x2')!;
    expect(m1x2.selections.map((s) => s.id)).toEqual([
      'fx_1:1x2:home',
      'fx_1:1x2:draw',
      'fx_1:1x2:away',
    ]);
  });

  it('mapeia bookmakers (incl. aliases Home/Draw/1/X) e preços', () => {
    const m1x2 = snaps.find((s) => s.market === '1x2')!;
    expect(m1x2.quotes.pinnacle['fx_1:1x2:home'].odd).toBe(2.0);
    expect(m1x2.quotes.betclic['fx_1:1x2:home'].odd).toBe(2.2);
    // "Home"/"Draw"/"Away" do 1xBet devem cair nas mesmas seleções de "1"/"X"/"2"
    expect(m1x2.quotes['1xbet']['fx_1:1x2:home'].odd).toBe(2.05);
    expect(m1x2.quotes['1xbet']['fx_1:1x2:away'].odd).toBe(3.8);
  });

  it('over_under capta a linha e as seleções over/under', () => {
    const ou = snaps.find((s) => s.market === 'over_under')!;
    expect(ou.line).toBe(2.5);
    expect(ou.selections.map((s) => s.id).sort()).toEqual([
      'fx_1:over_under:2.5:over',
      'fx_1:over_under:2.5:under',
    ]);
  });

  it('ignora bookmakers desconhecidos e preços inválidos', () => {
    const dirty: OddsPapiOddsResponse = {
      bookmakerOdds: {
        casa_random: { markets: { '1x2': { type: '1x2', outcomes: [{ name: '1', price: 2 }] } } },
        pinnacle: {
          markets: {
            '1x2': {
              type: '1x2',
              outcomes: [
                { name: '1', price: 1 }, // inválido (<=1) → ignorado
                { name: 'X', price: 3.5 },
                { name: '2', price: 3.9 },
              ],
            },
          },
        },
      },
    };
    const out = normalizeFixtureOdds(fixture, dirty);
    const m = out.find((s) => s.market === '1x2');
    // casa_random não mapeia; pinnacle só fica com X e 2 (1 inválido)
    expect(m?.quotes.pinnacle['fx_1:1x2:home']).toBeUndefined();
    expect(m?.quotes.pinnacle['fx_1:1x2:draw'].odd).toBe(3.5);
    expect((m?.quotes as Record<string, unknown>).casa_random).toBeUndefined();
  });
});
