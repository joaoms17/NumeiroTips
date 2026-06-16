import { describe, it, expect } from 'vitest';
import {
  matchData,
  competitions,
  matchesOf,
  getMatch,
  xgDelta,
  BUCKET_LABELS,
} from '../src/lib/matches';

describe('resumos de jogo (StatsBomb)', () => {
  it('carrega competições e jogos', () => {
    expect(competitions().length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(matchData.matches).length).toBeGreaterThan(50);
  });

  it('lista jogos de uma competição com rótulo', () => {
    const comp = competitions()[0];
    const list = matchesOf(comp);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].label).toMatch(/–/); // "Casa X–Y Fora"
    const m = getMatch(list[0].id);
    expect(m).toBeDefined();
    expect(m!.teams.length).toBe(2);
  });

  it('cada equipa tem 6 blocos de tempo coerentes com os totais', () => {
    const id = matchesOf(competitions()[0])[0].id;
    const m = getMatch(id)!;
    for (const t of m.teams) {
      expect(t.b.shots.length).toBe(BUCKET_LABELS.length);
      // soma dos blocos de remates = total de remates
      const sumShots = t.b.shots.reduce((a, b) => a + b, 0);
      expect(sumShots).toBe(t.shots);
      const sumGoals = t.b.goals.reduce((a, b) => a + b, 0);
      expect(sumGoals).toBe(t.goals);
    }
  });

  it('posse das duas equipas soma ~100%', () => {
    const id = matchesOf(competitions()[0])[0].id;
    const m = getMatch(id)!;
    expect(m.teams[0].poss + m.teams[1].poss).toBeCloseTo(100, 0);
  });

  it('xgDelta = xG − golos', () => {
    const t = getMatch(matchesOf(competitions()[0])[0].id)!.teams[0];
    expect(xgDelta(t)).toBeCloseTo(t.xg - t.goals, 2);
  });
});
