import { describe, it, expect } from 'vitest';
import { parseSnapshotPayload } from '../src/data/snapshotCacheProvider';
import type { MarketSnapshot } from '../src/lib/types';

const fakeSnap = { event: { id: 'e1' }, market: '1x2', selections: [] } as unknown as MarketSnapshot;

describe('parseSnapshotPayload', () => {
  it('lê { generatedAt, snapshots } com data ISO', () => {
    const r = parseSnapshotPayload({ generatedAt: '2026-06-18T08:00:00Z', snapshots: [fakeSnap] });
    expect(r.snapshots).toHaveLength(1);
    expect(r.generatedAt).toBe(Date.parse('2026-06-18T08:00:00Z'));
  });

  it('aceita generatedAt numérico (epoch ms)', () => {
    const r = parseSnapshotPayload({ generatedAt: 1718697600000, snapshots: [] });
    expect(r.generatedAt).toBe(1718697600000);
  });

  it('aceita um array nu de snapshots (sem envelope)', () => {
    const r = parseSnapshotPayload([fakeSnap, fakeSnap]);
    expect(r.snapshots).toHaveLength(2);
    expect(r.generatedAt).toBeNull();
  });

  it('payload inválido → vazio e seguro', () => {
    expect(parseSnapshotPayload(null).snapshots).toEqual([]);
    expect(parseSnapshotPayload('x').snapshots).toEqual([]);
    expect(parseSnapshotPayload({ snapshots: 'nope' }).snapshots).toEqual([]);
    expect(parseSnapshotPayload({ generatedAt: 'data-má', snapshots: [] }).generatedAt).toBeNull();
  });
});
