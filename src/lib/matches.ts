/**
 * Acesso aos resumos de jogo (StatsBomb) para o Explorador.
 * Dados HISTÓRICOS (Mundial 2022 + Euro 2024) — para explorar padrões.
 */
import data from '../data/matchSummaries.json';

export interface TeamMatchStat {
  name: string;
  shots: number;
  xg: number;
  corners: number;
  passes: number;
  goals: number;
  yellow: number;
  red: number;
  poss: number; // % posse (proxy = quota de passes)
  b: {
    shots: number[]; // 6 blocos de 15 min
    xg: number[];
    corners: number[];
    goals: number[];
  };
}

export interface MatchSummary {
  comp: string;
  date: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  stage: string;
  teams: [TeamMatchStat, TeamMatchStat]; // [casa, fora]
}

export interface MatchData {
  source: string;
  builtAt: string;
  competitions: Array<{ label: string; matchIds: number[] }>;
  matches: Record<string, MatchSummary>;
}

export const matchData = data as unknown as MatchData;

export const BUCKET_LABELS = ['0-15', '15-30', '30-45', '45-60', '60-75', '75-90'];

export function competitions(): string[] {
  return matchData.competitions.map((c) => c.label);
}

export interface MatchListItem {
  id: number;
  label: string;
  m: MatchSummary;
}

/** Jogos de uma competição, com rótulo legível. */
export function matchesOf(competition: string): MatchListItem[] {
  const comp = matchData.competitions.find((c) => c.label === competition);
  if (!comp) return [];
  return comp.matchIds
    .map((id) => {
      const m = matchData.matches[String(id)];
      return m
        ? { id, m, label: `${m.home} ${m.hs}–${m.as} ${m.away}${m.stage ? ` · ${m.stage}` : ''}` }
        : null;
    })
    .filter((x): x is MatchListItem => x != null);
}

export function getMatch(id: number): MatchSummary | undefined {
  return matchData.matches[String(id)];
}

/** Diferença xG − golos (sorte/eficácia): positivo = criou mais do que marcou. */
export function xgDelta(t: TeamMatchStat): number {
  return Math.round((t.xg - t.goals) * 100) / 100;
}
