import { describe, it, expect } from 'vitest';
import {
  normalizeApiFootballOdds,
  type AFFixtureMeta,
  type AFOddsEntry,
} from '../src/data/apiFootballOddsNormalize';

const meta: AFFixtureMeta = {
  id: '12345',
  home: 'Portugal',
  away: 'Espanha',
  league: 'World Cup',
  startsAt: '2026-06-20T20:00:00Z',
};

const entry: AFOddsEntry = {
  bookmakers: [
    {
      id: 4,
      name: 'Pinnacle',
      bets: [
        { id: 1, name: 'Match Winner', values: [
          { value: 'Home', odd: '2.10' },
          { value: 'Draw', odd: '3.40' },
          { value: 'Away', odd: '3.50' },
        ] },
        { id: 5, name: 'Goals Over/Under', values: [
          { value: 'Over 2.5', odd: '1.95' },
          { value: 'Under 2.5', odd: '1.90' },
        ] },
        { id: 8, name: 'Both Teams Score', values: [
          { value: 'Yes', odd: '1.80' },
          { value: 'No', odd: '2.00' },
        ] },
      ],
    },
    {
      id: 9,
      name: 'Betclic',
      bets: [
        { id: 1, name: 'Match Winner', values: [
          { value: 'Home', odd: '2.25' }, // melhor que Pinnacle → potencial +EV
          { value: 'Draw', odd: '3.30' },
          { value: 'Away', odd: '3.40' },
        ] },
      ],
    },
    {
      id: 999,
      name: 'CasaDesconhecida', // não mapeada → ignorada
      bets: [{ id: 1, name: 'Match Winner', values: [{ value: 'Home', odd: '5.0' }] }],
    },
  ],
};

describe('normalizeApiFootballOdds', () => {
  const snaps = normalizeApiFootballOdds(meta, entry);

  it('cria um snapshot por mercado (1x2, over/under, btts)', () => {
    const markets = snaps.map((s) => s.market).sort();
    expect(markets).toEqual(['1x2', 'btts', 'over_under']);
  });

  it('mapeia casas por nome (Pinnacle, Betclic) e ignora desconhecidas', () => {
    const x2 = snaps.find((s) => s.market === '1x2')!;
    expect(Object.keys(x2.quotes).sort()).toEqual(['betclic', 'pinnacle']);
  });

  it('lê a linha do over/under a partir do value', () => {
    const ou = snaps.find((s) => s.market === 'over_under')!;
    expect(ou.line).toBe(2.5);
    expect(ou.selections.map((s) => s.id).some((id) => id.endsWith(':over'))).toBe(true);
  });

  it('odds vêm como número e seleções com ids estáveis', () => {
    const x2 = snaps.find((s) => s.market === '1x2')!;
    const homeId = '12345:1x2:home';
    expect(x2.quotes.pinnacle?.[homeId]?.odd).toBe(2.1);
    expect(x2.quotes.betclic?.[homeId]?.odd).toBe(2.25);
  });

  it('jogo sem casas mapeadas → sem snapshots', () => {
    const empty = normalizeApiFootballOdds(meta, {
      bookmakers: [{ name: 'Desconhecida', bets: [] }],
    });
    expect(empty).toEqual([]);
  });
});
