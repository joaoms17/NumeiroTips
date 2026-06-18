import { describe, it, expect } from 'vitest';
import { useStore } from '../src/state/store';
import type { MarketSnapshot } from '../src/lib/types';

function snap(eventId: string): MarketSnapshot {
  const event = { id: eventId, sport: 'football' as const, league: 'WC', home: 'A', away: 'B', startsAt: '2026-07-01T20:00:00Z' };
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
      betclic: mk('betclic', [2.2, 3.6, 3.6]),
      '1xbet': mk('1xbet', [2.05, 3.7, 3.7]),
    } as MarketSnapshot['quotes'],
  };
}

describe('store: cache de snapshots', () => {
  it('um lote vazio NÃO apaga os snapshots existentes (créditos esgotados)', () => {
    const { ingestSnapshots } = useStore.getState();

    ingestSnapshots([snap('e1')]);
    const after = useStore.getState();
    expect(after.snapshots.length).toBe(1);
    expect(after.snapAt).toBeGreaterThan(0);
    const snapAtBefore = after.snapAt;

    // fonte devolve vazio → mantém o lote anterior
    ingestSnapshots([]);
    const kept = useStore.getState();
    expect(kept.snapshots.length).toBe(1);
    expect(kept.snapAt).toBe(snapAtBefore); // snapAt não muda num lote vazio
  });

  it('um novo lote não-vazio substitui e atualiza snapAt', () => {
    const { ingestSnapshots } = useStore.getState();
    ingestSnapshots([snap('e1')]);
    const t1 = useStore.getState().snapAt;
    ingestSnapshots([snap('e1'), snap('e2')]);
    const s2 = useStore.getState();
    expect(s2.snapshots.length).toBe(2);
    expect(s2.snapAt).toBeGreaterThanOrEqual(t1);
  });
});
