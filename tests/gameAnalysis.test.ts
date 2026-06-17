import { describe, it, expect } from 'vitest';
import { analyzeGame, upcomingEvents } from '../src/lib/gameAnalysis';
import { DEFAULT_ENGINE_CONFIG } from '../src/lib/types';
import type { MarketSnapshot } from '../src/lib/types';

function snap(eventId: string, startsAt: string): MarketSnapshot {
  const event = { id: eventId, sport: 'football' as const, league: 'WC', home: 'A', away: 'B', startsAt };
  const selections = [
    { id: `${eventId}:1x2:home`, eventId, market: '1x2' as const, line: null, label: 'A' },
    { id: `${eventId}:1x2:draw`, eventId, market: '1x2' as const, line: null, label: 'X' },
    { id: `${eventId}:1x2:away`, eventId, market: '1x2' as const, line: null, label: 'B' },
  ];
  const now = new Date().toISOString();
  const mk = (book: string, os: number[]) =>
    Object.fromEntries(selections.map((s, i) => [s.id, { selectionId: s.id, book, odd: os[i], capturedAt: now }]));
  return {
    event, market: '1x2', line: null, selections,
    quotes: {
      pinnacle: mk('pinnacle', [2.0, 4.0, 4.0]),
      betclic: mk('betclic', [2.2, 3.6, 3.6]), // home +EV
      '1xbet': mk('1xbet', [2.05, 3.7, 3.7]),
    } as MarketSnapshot['quotes'],
  };
}

describe('análise de jogo', () => {
  const snaps = [
    snap('e2', '2026-06-20T20:00:00Z'),
    snap('e1', '2026-06-18T18:00:00Z'),
  ];

  it('lista próximos jogos por ordem de início', () => {
    const ev = upcomingEvents(snaps, 10);
    expect(ev.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('analisa um jogo: melhores apostas +EV e preços justos', () => {
    const a = analyzeGame(snaps, 'e1', DEFAULT_ENGINE_CONFIG)!;
    expect(a.event.id).toBe('e1');
    expect(a.markets).toContain('1x2');
    // a casa (A) com betclic 2.2 acima do justo deve ser top +EV
    const top = a.topBets[0];
    expect(top.label).toBe('A');
    expect(top.bestBook).toBe('betclic');
    expect(top.bestEdge).toBeGreaterThan(0);
    // selecções ordenadas por edge desc
    for (let i = 1; i < a.selections.length; i++) {
      expect(a.selections[i - 1].bestEdge).toBeGreaterThanOrEqual(a.selections[i].bestEdge);
    }
  });

  it('jogo inexistente → null', () => {
    expect(analyzeGame(snaps, 'nada', DEFAULT_ENGINE_CONFIG)).toBeNull();
  });
});
