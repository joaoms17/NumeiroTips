import { describe, it, expect } from 'vitest';
import { scanArbitrage } from '../src/engine/arbitrage';
import type { MarketSnapshot, BookId } from '../src/lib/types';

function snap(odds: Record<BookId, [number, number, number]>): MarketSnapshot {
  const event = {
    id: 'e1',
    sport: 'football' as const,
    league: 'Teste',
    home: 'A',
    away: 'B',
    startsAt: new Date().toISOString(),
  };
  const selections = [
    { id: 'e1:1x2:home', eventId: 'e1', market: '1x2' as const, line: null, label: 'A' },
    { id: 'e1:1x2:draw', eventId: 'e1', market: '1x2' as const, line: null, label: 'X' },
    { id: 'e1:1x2:away', eventId: 'e1', market: '1x2' as const, line: null, label: 'B' },
  ];
  const now = new Date().toISOString();
  const quotes = {} as MarketSnapshot['quotes'];
  for (const [book, os] of Object.entries(odds) as [BookId, number[]][]) {
    quotes[book] = Object.fromEntries(
      selections.map((s, i) => [s.id, { selectionId: s.id, book, odd: os[i], capturedAt: now }]),
    );
  }
  return { event, market: '1x2', line: null, selections, quotes };
}

describe('scanArbitrage sobre snapshots', () => {
  it('encontra arbitragem combinando a melhor odd por resultado entre casas', () => {
    // Betclic forte na casa, 1xBet forte no empate/fora → cobre tudo com lucro
    const s = snap({
      betclic: [2.7, 3.2, 3.3],
      '1xbet': [2.4, 4.1, 3.9],
      pinnacle: [2.0, 3.6, 3.9], // ignorada (só régua)
      betfair: [2.5, 3.8, 3.7],
    } as Record<BookId, [number, number, number]>);
    const arbs = scanArbitrage([s], ['betclic', '1xbet', 'betfair'], 0);
    expect(arbs.length).toBe(1);
    expect(arbs[0].margin).toBeGreaterThan(0);
    // a melhor odd da casa é 2.7 (betclic), empate 4.1 e fora 3.9 (1xbet)
    expect(arbs[0].legs.find((l) => l.label === 'X')!.book).toBe('1xbet');
    // soma dos stakes ~ total (100 por defeito)
    const totalStakes = arbs[0].legs.reduce((acc, l) => acc + (l.stake ?? 0), 0);
    expect(totalStakes).toBeCloseTo(100, 0);
  });

  it('mercado normal não gera arbitragem', () => {
    const s = snap({
      betclic: [1.9, 3.3, 3.6],
      '1xbet': [1.88, 3.25, 3.55],
      betfair: [1.95, 3.4, 3.7],
    } as Record<BookId, [number, number, number]>);
    expect(scanArbitrage([s], ['betclic', '1xbet', 'betfair'], 0).length).toBe(0);
  });
});
