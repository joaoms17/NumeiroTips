import { describe, it, expect } from 'vitest';
import {
  allTeams,
  getProfile,
  matchupExpectedGoals,
  similarTeams,
  profiles,
} from '../src/lib/patterns';

describe('patterns (perfis StatsBomb)', () => {
  it('carrega perfis reais', () => {
    expect(profiles.teams.length).toBeGreaterThan(20);
    expect(profiles.leagueAvgGoalsPerTeam).toBeGreaterThan(0.8);
    expect(allTeams()).toBe(profiles.teams);
  });

  it('cada perfil tem ataque/defesa coerentes', () => {
    for (const t of profiles.teams) {
      expect(t.attack).toBeGreaterThan(0);
      expect(t.defense).toBeGreaterThan(0);
      expect(t.played).toBeGreaterThanOrEqual(3);
    }
  });

  it('confronto: equipa de ataque forte vs defesa fraca → λ alto', () => {
    const teams = profiles.teams;
    const strongAtt = teams.reduce((a, b) => (b.attack > a.attack ? b : a));
    const weakDef = teams.reduce((a, b) => (b.defense > a.defense ? b : a)); // maior = pior defesa
    const m = matchupExpectedGoals(strongAtt.team, weakDef.team);
    expect(m).not.toBeNull();
    expect(m!.lambda).toBeGreaterThan(profiles.leagueAvgGoalsPerTeam); // acima da média
  });

  it('confronto desconhecido → null', () => {
    expect(matchupExpectedGoals('Equipa Inexistente', 'Outra')).toBeNull();
  });

  it('vantagem caseira aumenta λ e reduz μ', () => {
    const home = profiles.teams[0].team;
    const away = profiles.teams[1].team;
    const neutral = matchupExpectedGoals(home, away, 1.0)!;
    const withAdv = matchupExpectedGoals(home, away, 1.2)!;
    expect(withAdv.lambda).toBeGreaterThan(neutral.lambda);
    expect(withAdv.mu).toBeLessThan(neutral.mu);
  });

  it('similares: devolve k equipas ordenadas por distância e exclui a própria', () => {
    const t = profiles.teams[0].team;
    const sims = similarTeams(t, 5);
    expect(sims.length).toBe(5);
    expect(sims.every((s) => s.team !== t)).toBe(true);
    for (let i = 1; i < sims.length; i++) {
      expect(sims[i].distance).toBeGreaterThanOrEqual(sims[i - 1].distance);
    }
  });

  it('similares de equipa desconhecida → vazio', () => {
    expect(similarTeams('Nada', 5)).toEqual([]);
    expect(getProfile('Nada')).toBeUndefined();
  });
});
