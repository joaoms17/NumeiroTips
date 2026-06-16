import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../src/state/analytics';
import type { TrackedBet } from '../src/lib/types';

function bet(p: Partial<TrackedBet>): TrackedBet {
  return {
    id: Math.random().toString(36).slice(2),
    valueBetId: 'vb',
    label: 'A v B — Casa',
    book: 'betclic',
    stake: 10,
    odd: 2.0,
    fairOddAtBet: 1.95,
    edgeAtBet: 0.03,
    result: 'pending',
    pnl: null,
    clv: null,
    placedAt: '2026-06-16T10:00:00Z',
    settledAt: null,
    ...p,
  };
}

describe('analytics', () => {
  it('vazio → tudo a zero', () => {
    const a = computeAnalytics([], 1000);
    expect(a.settledCount).toBe(0);
    expect(a.totalPnl).toBe(0);
    expect(a.roi).toBe(0);
    expect(a.pnlSeries).toEqual([]);
    expect(a.bankrollSeries).toEqual([1000]);
  });

  it('P/L acumulado, ROI e win rate', () => {
    const bets = [
      bet({ result: 'won', stake: 10, odd: 2.0, pnl: 10, settledAt: '2026-06-16T11:00:00Z' }),
      bet({ result: 'lost', stake: 10, odd: 2.0, pnl: -10, settledAt: '2026-06-16T12:00:00Z' }),
      bet({ result: 'won', stake: 10, odd: 3.0, pnl: 20, settledAt: '2026-06-16T13:00:00Z' }),
    ];
    const a = computeAnalytics(bets, 1000);
    expect(a.settledCount).toBe(3);
    expect(a.totalStaked).toBe(30);
    expect(a.totalPnl).toBe(20);
    expect(a.roi).toBeCloseTo(20 / 30, 6);
    expect(a.winRate).toBeCloseTo(2 / 3, 6);
    // série acumulada: +10, 0, +20
    expect(a.pnlSeries.map((p) => p.cumPnl)).toEqual([10, 0, 20]);
    // banca: 1000, 1010, 1000, 1020
    expect(a.bankrollSeries).toEqual([1000, 1010, 1000, 1020]);
  });

  it('CLV médio e taxa de bater o fecho', () => {
    const bets = [
      bet({ result: 'won', pnl: 10, clv: 0.05, settledAt: '2026-06-16T11:00:00Z' }),
      bet({ result: 'lost', pnl: -10, clv: -0.02, settledAt: '2026-06-16T12:00:00Z' }),
      bet({ result: 'won', pnl: 10, clv: 0.03, settledAt: '2026-06-16T13:00:00Z' }),
    ];
    const a = computeAnalytics(bets, 1000);
    expect(a.avgClv).toBeCloseTo((0.05 - 0.02 + 0.03) / 3, 6);
    expect(a.clvBeatRate).toBeCloseTo(2 / 3, 6); // 2 de 3 com CLV>0
  });

  it('ordena por liquidação e ignora pendentes', () => {
    const bets = [
      bet({ result: 'pending' }),
      bet({ result: 'won', pnl: 5, settledAt: '2026-06-16T13:00:00Z' }),
      bet({ result: 'won', pnl: 7, settledAt: '2026-06-16T11:00:00Z' }),
    ];
    const a = computeAnalytics(bets, 100);
    expect(a.pendingCount).toBe(1);
    // cronológico: 11:00 (+7) depois 13:00 (+5) → 7, 12
    expect(a.pnlSeries.map((p) => p.cumPnl)).toEqual([7, 12]);
  });

  it('maior ganho e maior perda', () => {
    const bets = [
      bet({ result: 'won', pnl: 25, settledAt: '2026-06-16T11:00:00Z' }),
      bet({ result: 'lost', pnl: -15, settledAt: '2026-06-16T12:00:00Z' }),
    ];
    const a = computeAnalytics(bets, 100);
    expect(a.biggestWin).toBe(25);
    expect(a.biggestLoss).toBe(-15);
  });
});
