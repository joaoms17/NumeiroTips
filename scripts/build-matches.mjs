/**
 * build-matches.mjs — resumos por jogo para o Explorador (decisão).
 * Corre OFFLINE (node scripts/build-matches.mjs) e escreve
 * src/data/matchSummaries.json: por jogo, estatísticas por equipa e por blocos
 * de 15 min (remates, xG, cantos, golos) + posse (proxy = quota de passes).
 *
 * Fonte: StatsBomb Open Data (Mundial 2022 + Euro 2024). É HISTÓRICO — serve
 * para explorar padrões e treinar a tua leitura, não para o jogo de hoje.
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

const NB = 6; // 6 blocos de 15 min
const bucket = (minute) => Math.min(NB - 1, Math.floor((minute ?? 0) / 15));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json();
}

function emptyTeam(name) {
  return {
    name,
    shots: 0, xg: 0, corners: 0, passes: 0, goals: 0, yellow: 0, red: 0,
    b: { shots: Array(NB).fill(0), xg: Array(NB).fill(0), corners: Array(NB).fill(0), goals: Array(NB).fill(0) },
  };
}

function cardName(e) {
  return e.foul_committed?.card?.name ?? e.bad_behaviour?.card?.name ?? null;
}

async function summarize(matchId, homeName, awayName) {
  const events = await fetchJson(`${BASE}/events/${matchId}.json`);
  const teams = { [homeName]: emptyTeam(homeName), [awayName]: emptyTeam(awayName) };
  for (const e of events) {
    const tn = e.team?.name;
    const t = teams[tn];
    if (!t) continue;
    const bi = bucket(e.minute);
    if (e.type?.name === 'Shot') {
      t.shots += 1;
      t.b.shots[bi] += 1;
      const xg = e.shot?.statsbomb_xg ?? 0;
      t.xg += xg;
      t.b.xg[bi] += xg;
      if (e.shot?.outcome?.name === 'Goal') {
        t.goals += 1;
        t.b.goals[bi] += 1;
      }
    }
    if (e.type?.name === 'Pass') {
      t.passes += 1;
      if (e.pass?.type?.name === 'Corner') {
        t.corners += 1;
        t.b.corners[bi] += 1;
      }
    }
    const card = cardName(e);
    if (card === 'Yellow Card') t.yellow += 1;
    else if (card === 'Red Card' || card === 'Second Yellow') t.red += 1;
  }
  // posse = quota de passes
  const tp = teams[homeName].passes + teams[awayName].passes || 1;
  for (const t of Object.values(teams)) {
    t.poss = Math.round((t.passes / tp) * 1000) / 10; // %
    t.xg = Math.round(t.xg * 1000) / 1000;
    t.b.xg = t.b.xg.map((x) => Math.round(x * 1000) / 1000);
  }
  return teams;
}

async function main() {
  const competitions = [];
  const matches = {};

  for (const src of SOURCES) {
    const list = await fetchJson(`${BASE}/matches/${src.comp}/${src.season}.json`);
    const ids = [];
    let done = 0;
    for (const m of list) {
      const home = m.home_team.home_team_name;
      const away = m.away_team.away_team_name;
      try {
        const teams = await summarize(m.match_id, home, away);
        matches[m.match_id] = {
          comp: src.label,
          date: m.match_date,
          home, away,
          hs: m.home_score, as: m.away_score,
          stage: m.competition_stage?.name ?? '',
          teams: [teams[home], teams[away]],
        };
        ids.push(m.match_id);
      } catch (e) {
        console.warn('falhou', m.match_id, String(e));
      }
      done++;
      if (done % 20 === 0) console.log(`  ${src.label}: ${done}/${list.length}`);
    }
    competitions.push({ label: src.label, matchIds: ids });
  }

  const out = { source: 'StatsBomb Open Data', builtAt: new Date().toISOString(), competitions, matches };
  mkdirSync(`${ROOT}/src/data`, { recursive: true });
  writeFileSync(`${ROOT}/src/data/matchSummaries.json`, JSON.stringify(out));
  const n = Object.keys(matches).length;
  console.log(`Escrito src/data/matchSummaries.json — ${n} jogos`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
