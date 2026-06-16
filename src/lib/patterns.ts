/**
 * Patterns / perfis de equipa (data-driven, StatsBomb Open Data)
 * ==============================================================
 *
 * Usa ratings de ataque/defesa pré-computados de torneios reais
 * (`src/data/teamProfiles.json`, gerado por scripts/build-profiles.mjs) para:
 *
 *  - estimar os golos esperados de um confronto (modelo de força de Poisson),
 *    alimentando o modelo Ao Vivo / pré-jogo com λ/μ derivados de DADOS em vez
 *    de palpites;
 *  - encontrar "equipas semelhantes" por perfil (ataque×defesa) — a base para
 *    raciocinar por analogia ("contra equipas parecidas, isto costuma…").
 *
 * Honestidade: a amostra de torneio é pequena (3–7 jogos/equipa), logo os
 * ratings têm ruído. É um ponto de partida real e transparente; trocar o JSON
 * por um pré-computo de épocas de liga completas melhora a estabilidade.
 */
import profilesJson from '../data/teamProfiles.json';

export interface TeamProfile {
  team: string;
  played: number;
  gfpg: number; // golos marcados por jogo
  gapg: number; // golos sofridos por jogo
  attack: number; // relativo à média (>1 = ataca acima da média)
  defense: number; // relativo à média (<1 = sofre menos que a média)
}

export interface ProfilesData {
  source: string;
  competitions: Array<{ label: string; matches: number }>;
  leagueAvgGoalsPerTeam: number;
  builtAt: string;
  teams: TeamProfile[];
}

export const profiles = profilesJson as ProfilesData;

const byName = new Map(profiles.teams.map((t) => [t.team, t]));

export function allTeams(): TeamProfile[] {
  return profiles.teams;
}

export function getProfile(team: string): TeamProfile | undefined {
  return byName.get(team);
}

/**
 * Golos esperados de um confronto (modelo de força de Poisson):
 *   λ_casa = média · ataque_casa · defesa_fora · vantagem
 *   μ_fora = média · ataque_fora · defesa_casa / vantagem
 * Em terreno neutro (torneios) usa-se vantagem = 1.
 */
export function matchupExpectedGoals(
  home: string,
  away: string,
  homeAdvantage = 1.0,
): { lambda: number; mu: number } | null {
  const h = byName.get(home);
  const a = byName.get(away);
  if (!h || !a) return null;
  const avg = profiles.leagueAvgGoalsPerTeam;
  return {
    lambda: round2(avg * h.attack * a.defense * homeAdvantage),
    mu: round2((avg * a.attack * h.defense) / homeAdvantage),
  };
}

export interface SimilarTeam {
  team: string;
  distance: number;
  attack: number;
  defense: number;
}

/**
 * Equipas mais semelhantes por perfil (distância euclidiana no espaço
 * ataque×defesa). Útil para raciocinar por analogia.
 */
export function similarTeams(team: string, k = 5): SimilarTeam[] {
  const t = byName.get(team);
  if (!t) return [];
  return profiles.teams
    .filter((o) => o.team !== team)
    .map((o) => ({
      team: o.team,
      attack: o.attack,
      defense: o.defense,
      distance: Math.hypot(o.attack - t.attack, o.defense - t.defense),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
