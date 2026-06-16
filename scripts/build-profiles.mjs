/**
 * build-profiles.mjs — pré-computo de perfis de equipa a partir do StatsBomb
 * Open Data (grátis). Corre OFFLINE (node scripts/build-profiles.mjs) e escreve
 * src/data/teamProfiles.json, que é compacto e vai com a app.
 *
 * Usa torneios de seleções com cobertura COMPLETA (todas as equipas, sem viés):
 * Mundial 2022 e Euro 2024. Calcula, por equipa, ataque e defesa relativos à
 * média (golos marcados/sofridos por jogo / média global).
 *
 * Nota: amostra de torneio é pequena (3–7 jogos/equipa) → ratings com ruído.
 * É real e serve de base; para ratings estáveis usar épocas de liga completas.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';

const SOURCES = [
  { comp: 43, season: 106, label: 'Mundial 2022' },
  { comp: 55, season: 282, label: 'Euro 2024' },
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json();
}

/** Conta remates, xG e cantos por equipa a partir dos eventos de um jogo. */
async function matchEventStats(matchId) {
  const events = await fetchJson(`${BASE}/events/${matchId}.json`);
  const per = new Map(); // team -> { shots, xg, corners }
  for (const e of events) {
    const team = e.team?.name;
    if (!team) continue;
    const s = per.get(team) ?? { shots: 0, xg: 0, corners: 0 };
    if (e.type?.name === 'Shot') {
      s.shots += 1;
      s.xg += e.shot?.statsbomb_xg ?? 0;
    }
    if (e.pass?.type?.name === 'Corner') s.corners += 1;
    per.set(team, s);
  }
  return per;
}

async function main() {
  const teams = new Map(); // name -> agregados
  let totalGoals = 0;
  let totalTeamMatches = 0;
  const competitions = [];

  for (const src of SOURCES) {
    const matches = await fetchJson(`${BASE}/matches/${src.comp}/${src.season}.json`);
    competitions.push({ label: src.label, matches: matches.length });
    let done = 0;
    for (const m of matches) {
      const h = m.home_team.home_team_name;
      const a = m.away_team.away_team_name;
      const hs = m.home_score;
      const as = m.away_score;
      if (hs == null || as == null) continue;
      bump(teams, h, a, hs, as);
      bump(teams, a, h, as, hs);
      totalGoals += hs + as;
      totalTeamMatches += 2;

      // eventos: remates / xG / cantos por equipa (best-effort)
      try {
        const stats = await matchEventStats(m.match_id);
        addEventStats(teams, h, a, stats);
        addEventStats(teams, a, h, stats);
      } catch (e) {
        console.warn('eventos falharam', m.match_id, String(e));
      }
      done++;
      if (done % 20 === 0) console.log(`  ${src.label}: ${done}/${matches.length}`);
    }
  }

  const avg = totalGoals / totalTeamMatches; // golos por equipa por jogo

  // médias de liga (por equipa por jogo) para remates/xg/cantos
  const sum = (sel) => [...teams.values()].reduce((acc, s) => acc + sel(s), 0);
  const totalShots = sum((s) => s.shotsFor);
  const totalXg = sum((s) => s.xgFor);
  const totalCorners = sum((s) => s.cornersFor);
  const tm = totalTeamMatches || 1;
  const avgShots = totalShots / tm;
  const avgXg = totalXg / tm;
  const avgCorners = totalCorners / tm;

  const profiles = [];
  for (const [name, s] of teams) {
    if (s.played < 3) continue;
    const gfpg = s.gf / s.played;
    const gapg = s.ga / s.played;
    profiles.push({
      team: name,
      played: s.played,
      gfpg: round(gfpg, 3),
      gapg: round(gapg, 3),
      attack: round(gfpg / avg, 3),
      defense: round(gapg / avg, 3),
      shotsFor: round(s.shotsFor / s.played, 2),
      shotsAgainst: round(s.shotsAgainst / s.played, 2),
      xgFor: round(s.xgFor / s.played, 3),
      xgAgainst: round(s.xgAgainst / s.played, 3),
      cornersFor: round(s.cornersFor / s.played, 2),
      cornersAgainst: round(s.cornersAgainst / s.played, 2),
    });
  }
  profiles.sort((a, b) => b.attack - a.attack);

  const out = {
    source: 'StatsBomb Open Data',
    competitions,
    leagueAvgGoalsPerTeam: round(avg, 3),
    leagueAvgShotsPerTeam: round(avgShots, 2),
    leagueAvgXgPerTeam: round(avgXg, 3),
    leagueAvgCornersPerTeam: round(avgCorners, 2),
    builtAt: new Date().toISOString(),
    teams: profiles,
  };

  mkdirSync(`${ROOT}/src/data`, { recursive: true });
  writeFileSync(`${ROOT}/src/data/teamProfiles.json`, JSON.stringify(out, null, 2));
  console.log(`Escrito src/data/teamProfiles.json — ${profiles.length} equipas, avg ${out.leagueAvgGoalsPerTeam}`);
}

function emptyTeam() {
  return {
    played: 0, gf: 0, ga: 0,
    shotsFor: 0, shotsAgainst: 0, xgFor: 0, xgAgainst: 0, cornersFor: 0, cornersAgainst: 0,
  };
}

function bump(map, name, _opp, gf, ga) {
  const s = map.get(name) ?? emptyTeam();
  s.played += 1;
  s.gf += gf;
  s.ga += ga;
  map.set(name, s);
}

/** Acumula remates/xG/cantos a favor (próprios) e contra (do adversário). */
function addEventStats(map, name, opp, stats) {
  const s = map.get(name) ?? emptyTeam();
  const me = stats.get(name) ?? { shots: 0, xg: 0, corners: 0 };
  const other = stats.get(opp) ?? { shots: 0, xg: 0, corners: 0 };
  s.shotsFor += me.shots;
  s.xgFor += me.xg;
  s.cornersFor += me.corners;
  s.shotsAgainst += other.shots;
  s.xgAgainst += other.xg;
  s.cornersAgainst += other.corners;
  map.set(name, s);
}

function round(x, d = 3) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
