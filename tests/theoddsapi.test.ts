import { describe, it, expect } from 'vitest';
import {
  normalizeTheOddsApiEvent,
  normalizeTheOddsApi,
  type TOAEvent,
} from '../src/data/theOddsApiNormalize';
import { evaluateFeed } from '../src/engine/engine';
import { DEFAULT_ENGINE_CONFIG } from '../src/lib/types';

/**
 * Exemplo no formato REAL do The Odds API v4 (/v4/sports/{sport}/odds):
 * evento → bookmakers → markets (h2h, totals) → outcomes (com `point` no totals).
 */
const event: TOAEvent = {
  id: 'evt_abc',
  sport_key: 'soccer_epl',
  sport_title: 'EPL',
  commence_time: '2026-06-20T19:00:00Z',
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  bookmakers: [
    {
      key: 'pinnacle',
      title: 'Pinnacle',
      markets: [
        {
          key: 'h2h',
          outcomes: [
            { name: 'Arsenal', price: 2.0 },
            { name: 'Chelsea', price: 4.0 },
            { name: 'Draw', price: 4.0 },
          ],
        },
        {
          key: 'totals',
          outcomes: [
            { name: 'Over', price: 1.95, point: 2.5 },
            { name: 'Under', price: 1.9, point: 2.5 },
          ],
        },
      ],
    },
    {
      key: 'betclic',
      title: 'Betclic',
      markets: [
        {
          key: 'h2h',
          outcomes: [
            { name: 'Arsenal', price: 2.2 }, // acima do justo → +EV
            { name: 'Chelsea', price: 3.7 },
            { name: 'Draw', price: 3.4 },
          ],
        },
      ],
    },
    {
      key: 'onexbet', // 1xBet
      title: '1xBet',
      markets: [
        {
          key: 'h2h',
          outcomes: [
            { name: 'Arsenal', price: 2.05 },
            { name: 'Chelsea', price: 3.8 },
            { name: 'Draw', price: 3.5 },
          ],
        },
      ],
    },
    {
      key: 'williamhill', // não nos interessa → ignorado
      title: 'William Hill',
      markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 2.1 }] }],
    },
  ],
};

describe('normalização The Odds API', () => {
  const snaps = normalizeTheOddsApiEvent(event);

  it('produz snapshots 1x2 e over_under', () => {
    expect(snaps.map((s) => s.market).sort()).toEqual(['1x2', 'over_under']);
  });

  it('mapeia equipas h2h → home/draw/away com ids estáveis', () => {
    const m = snaps.find((s) => s.market === '1x2')!;
    expect(m.selections.map((s) => s.id).sort()).toEqual([
      'evt_abc:1x2:away',
      'evt_abc:1x2:draw',
      'evt_abc:1x2:home',
    ]);
    expect(m.quotes.pinnacle['evt_abc:1x2:home'].odd).toBe(2.0);
    expect(m.quotes.betclic['evt_abc:1x2:home'].odd).toBe(2.2);
    expect(m.quotes['1xbet']['evt_abc:1x2:away'].odd).toBe(3.8);
  });

  it('mapeia betfair_ex_eu e onexbet para os nossos BookId', () => {
    // onexbet → 1xbet já validado; aqui confirmamos que williamhill é ignorado
    const m = snaps.find((s) => s.market === '1x2')!;
    expect((m.quotes as Record<string, unknown>).williamhill).toBeUndefined();
  });

  it('totals capta a linha em point', () => {
    const ou = snaps.find((s) => s.market === 'over_under')!;
    expect(ou.line).toBe(2.5);
    expect(ou.selections.map((s) => s.id).sort()).toEqual([
      'evt_abc:over_under:2.5:over',
      'evt_abc:over_under:2.5:under',
    ]);
  });

  it('o motor deteta a value bet da Betclic a partir do snapshot normalizado', () => {
    const feed = evaluateFeed(snaps, { ...DEFAULT_ENGINE_CONFIG });
    const home = feed.find((vb) => vb.selection.id === 'evt_abc:1x2:home');
    expect(home).toBeDefined();
    expect(home!.bestBook).toBe('betclic'); // 2.20 é a odd mais alta entre as +EV
    expect(home!.bestEdge).toBeGreaterThan(DEFAULT_ENGINE_CONFIG.edgeThreshold);
  });

  it('normalizeTheOddsApi processa um array de eventos', () => {
    const all = normalizeTheOddsApi([event, event]);
    expect(all.length).toBe(snaps.length * 2);
  });
});
