import { describe, it, expect } from 'vitest';
import { teamsWithTrends, teamTrends } from '../src/lib/trends';

describe('tendências por equipa', () => {
  const teams = teamsWithTrends();

  it('lista equipas com histórico', () => {
    expect(teams.length).toBeGreaterThan(10);
  });

  it('métricas coerentes para uma equipa', () => {
    const t = teamTrends(teams[0])!;
    expect(t.played).toBeGreaterThan(0);
    // percentagens em [0,1]
    for (const p of [t.over25, t.bttsPct, t.cleanSheetPct, t.over15, t.over35]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    // over1.5 >= over2.5 >= over3.5 (monótono)
    expect(t.over15).toBeGreaterThanOrEqual(t.over25);
    expect(t.over25).toBeGreaterThanOrEqual(t.over35);
    // forma: cada entrada é W/D/L
    expect(t.form.every((r) => ['W', 'D', 'L'].includes(r))).toBe(true);
    // cantos total >= cantos próprios
    expect(t.cornersTotalAvg).toBeGreaterThanOrEqual(t.cornersForAvg);
  });

  it('equipa desconhecida → null', () => {
    expect(teamTrends('Inexistente FC')).toBeNull();
  });
});
