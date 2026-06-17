/**
 * Tendências históricas por equipa — para decisão em vários mercados.
 * Calcula, a partir dos resumos de jogo (StatsBomb), métricas como over X.5%,
 * BTTS%, média de cantos/cartões e forma recente. Dados HISTÓRICOS.
 */
import { matchData, type MatchSummary, type TeamMatchStat } from './matches';

export type FormResult = 'W' | 'D' | 'L';

export interface TeamTrends {
  team: string;
  played: number;
  // golos
  gfAvg: number;
  gaAvg: number;
  totalGoalsAvg: number;
  over15: number;
  over25: number;
  over35: number;
  bttsPct: number;
  cleanSheetPct: number;
  failedToScorePct: number;
  // cantos / cartões
  cornersForAvg: number;
  cornersTotalAvg: number;
  cardsForAvg: number; // amarelos + 2× vermelhos? não — só contagem amarelos+vermelhos
  cardsTotalAvg: number;
  // forma recente (mais recente primeiro)
  form: FormResult[];
  recentGoalsFor: number[];
}

interface TeamMatch {
  date: string;
  m: MatchSummary;
  me: TeamMatchStat;
  opp: TeamMatchStat;
  gf: number;
  ga: number;
}

let indexCache: Map<string, TeamMatch[]> | null = null;

function buildIndex(): Map<string, TeamMatch[]> {
  if (indexCache) return indexCache;
  const idx = new Map<string, TeamMatch[]>();
  for (const m of Object.values(matchData.matches)) {
    const [homeT, awayT] = m.teams;
    pushTeam(idx, m.home, m, homeT, awayT, m.hs, m.as);
    pushTeam(idx, m.away, m, awayT, homeT, m.as, m.hs);
  }
  // ordena cronologicamente (antigo → recente)
  for (const arr of idx.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  indexCache = idx;
  return idx;
}

function pushTeam(
  idx: Map<string, TeamMatch[]>,
  team: string,
  m: MatchSummary,
  me: TeamMatchStat,
  opp: TeamMatchStat,
  gf: number,
  ga: number,
) {
  const arr = idx.get(team) ?? [];
  arr.push({ date: m.date, m, me, opp, gf, ga });
  idx.set(team, arr);
}

export function teamsWithTrends(): string[] {
  return [...buildIndex().keys()].sort();
}

export function teamTrends(team: string, recent = 5): TeamTrends | null {
  const matches = buildIndex().get(team);
  if (!matches || matches.length === 0) return null;
  const n = matches.length;
  const pctOf = (cond: (x: TeamMatch) => boolean) =>
    matches.filter(cond).length / n;
  const avg = (sel: (x: TeamMatch) => number) =>
    matches.reduce((s, x) => s + sel(x), 0) / n;

  const last = matches.slice(-recent).reverse(); // mais recente primeiro
  const form: FormResult[] = last.map((x) => (x.gf > x.ga ? 'W' : x.gf < x.ga ? 'L' : 'D'));

  return {
    team,
    played: n,
    gfAvg: round2(avg((x) => x.gf)),
    gaAvg: round2(avg((x) => x.ga)),
    totalGoalsAvg: round2(avg((x) => x.gf + x.ga)),
    over15: round3(pctOf((x) => x.gf + x.ga > 1.5)),
    over25: round3(pctOf((x) => x.gf + x.ga > 2.5)),
    over35: round3(pctOf((x) => x.gf + x.ga > 3.5)),
    bttsPct: round3(pctOf((x) => x.gf > 0 && x.ga > 0)),
    cleanSheetPct: round3(pctOf((x) => x.ga === 0)),
    failedToScorePct: round3(pctOf((x) => x.gf === 0)),
    cornersForAvg: round2(avg((x) => x.me.corners)),
    cornersTotalAvg: round2(avg((x) => x.me.corners + x.opp.corners)),
    cardsForAvg: round2(avg((x) => x.me.yellow + x.me.red)),
    cardsTotalAvg: round2(avg((x) => x.me.yellow + x.me.red + x.opp.yellow + x.opp.red)),
    form,
    recentGoalsFor: last.map((x) => x.gf),
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
