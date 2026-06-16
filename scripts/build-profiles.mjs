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

async function main() {
  const teams = new Map(); // name -> { played, gf, ga }
  let totalGoals = 0;
  let totalTeamMatches = 0;
  const competitions = [];

  for (const src of SOURCES) {
    const matches = await fetchJson(`${BASE}/matches/${src.comp}/${src.season}.json`);
    competitions.push({ label: src.label, matches: matches.length });
    for (const m of matches) {
      const h = m.home_team.home_team_name;
      const a = m.away_team.away_team_name;
      const hs = m.home_score;
      const as = m.away_score;
      if (hs == null || as == null) continue;
      bump(teams, h, hs, as);
      bump(teams, a, as, hs);
      totalGoals += hs + as;
      totalTeamMatches += 2;
    }
  }

  const avg = totalGoals / totalTeamMatches; // golos por equipa por jogo (média)

  const profiles = [];
  for (const [name, s] of teams) {
    if (s.played < 3) continue; // reduz ruído
    const gfpg = s.gf / s.played;
    const gapg = s.ga / s.played;
    profiles.push({
      team: name,
      played: s.played,
      gfpg: round(gfpg, 3),
      gapg: round(gapg, 3),
      attack: round(gfpg / avg, 3), // >1 = ataca acima da média
      defense: round(gapg / avg, 3), // <1 = defende acima da média (sofre menos)
    });
  }
  profiles.sort((a, b) => b.attack - a.attack);

  const out = {
    source: 'StatsBomb Open Data',
    competitions,
    leagueAvgGoalsPerTeam: round(avg, 3),
    builtAt: new Date().toISOString(),
    teams: profiles,
  };

  mkdirSync(`${ROOT}/src/data`, { recursive: true });
  writeFileSync(`${ROOT}/src/data/teamProfiles.json`, JSON.stringify(out, null, 2));
  console.log(`Escrito src/data/teamProfiles.json — ${profiles.length} equipas, avg ${out.leagueAvgGoalsPerTeam}`);
}

function bump(map, name, gf, ga) {
  const s = map.get(name) ?? { played: 0, gf: 0, ga: 0 };
  s.played += 1;
  s.gf += gf;
  s.ga += ga;
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
