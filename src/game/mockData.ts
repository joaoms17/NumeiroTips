/**
 * Dados de exemplo do Mundial 2026 — para a app ser jogável e animada já,
 * antes de ligar a API-Football real. Inclui 2 dias terminados (com ratings e
 * palpites dos 4 → a tabela mostra números) + hoje + dias seguintes.
 */
import type { Footballer, Match, NationTeam, Pick, Pos } from './types';

const T = (code: string, name: string, flag: string): NationTeam => ({ code, name, flag });

export const TEAMS: Record<string, NationTeam> = {
  POR: T('POR', 'Portugal', '🇵🇹'),
  ESP: T('ESP', 'Espanha', '🇪🇸'),
  BRA: T('BRA', 'Brasil', '🇧🇷'),
  ARG: T('ARG', 'Argentina', '🇦🇷'),
  FRA: T('FRA', 'França', '🇫🇷'),
  ENG: T('ENG', 'Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  NED: T('NED', 'Holanda', '🇳🇱'),
  MEX: T('MEX', 'México', '🇲🇽'),
  USA: T('USA', 'EUA', '🇺🇸'),
  CRO: T('CRO', 'Croácia', '🇭🇷'),
};

function pl(team: string, name: string, pos: Pos, number: number): Footballer {
  return { id: `${team}-${number}`, name, team, pos, number };
}

const SQUADS: Record<string, Footballer[]> = {
  POR: [
    pl('POR', 'Diogo Costa', 'GR', 22), pl('POR', 'Cancelo', 'DEF', 20), pl('POR', 'Rúben Dias', 'DEF', 3),
    pl('POR', 'Bruno F.', 'MED', 8), pl('POR', 'Vitinha', 'MED', 16),
    pl('POR', 'Rafael Leão', 'AVA', 15), pl('POR', 'Ronaldo', 'AVA', 7), pl('POR', 'João Félix', 'AVA', 11),
  ],
  ESP: [
    pl('ESP', 'Simón', 'GR', 23), pl('ESP', 'Carvajal', 'DEF', 2), pl('ESP', 'Laporte', 'DEF', 14),
    pl('ESP', 'Pedri', 'MED', 8), pl('ESP', 'Rodri', 'MED', 16),
    pl('ESP', 'Yamal', 'AVA', 19), pl('ESP', 'Morata', 'AVA', 7), pl('ESP', 'N. Williams', 'AVA', 17),
  ],
  BRA: [
    pl('BRA', 'Alisson', 'GR', 1), pl('BRA', 'Militão', 'DEF', 3), pl('BRA', 'Marquinhos', 'DEF', 4),
    pl('BRA', 'Bruno G.', 'MED', 5), pl('BRA', 'Paquetá', 'MED', 7),
    pl('BRA', 'Vinícius Jr', 'AVA', 20), pl('BRA', 'Rodrygo', 'AVA', 10), pl('BRA', 'Raphinha', 'AVA', 19),
  ],
  ARG: [
    pl('ARG', 'E. Martínez', 'GR', 23), pl('ARG', 'Molina', 'DEF', 26), pl('ARG', 'Otamendi', 'DEF', 19),
    pl('ARG', 'Mac Allister', 'MED', 20), pl('ARG', 'E. Fernández', 'MED', 24),
    pl('ARG', 'Messi', 'AVA', 10), pl('ARG', 'J. Álvarez', 'AVA', 9), pl('ARG', 'Dybala', 'AVA', 21),
  ],
  FRA: [
    pl('FRA', 'Maignan', 'GR', 16), pl('FRA', 'T. Hernández', 'DEF', 22), pl('FRA', 'Saliba', 'DEF', 17),
    pl('FRA', 'Tchouaméni', 'MED', 8), pl('FRA', 'Griezmann', 'MED', 7),
    pl('FRA', 'Mbappé', 'AVA', 10), pl('FRA', 'Dembélé', 'AVA', 11), pl('FRA', 'Thuram', 'AVA', 15),
  ],
  ENG: [
    pl('ENG', 'Pickford', 'GR', 1), pl('ENG', 'Walker', 'DEF', 2), pl('ENG', 'Stones', 'DEF', 5),
    pl('ENG', 'Bellingham', 'MED', 10), pl('ENG', 'Rice', 'MED', 4),
    pl('ENG', 'Kane', 'AVA', 9), pl('ENG', 'Foden', 'AVA', 20), pl('ENG', 'Saka', 'AVA', 7),
  ],
  NED: [
    pl('NED', 'Verbruggen', 'GR', 1), pl('NED', 'Dumfries', 'DEF', 22), pl('NED', 'Van Dijk', 'DEF', 4),
    pl('NED', 'Gakpo', 'MED', 8), pl('NED', 'Reijnders', 'MED', 14),
    pl('NED', 'Depay', 'AVA', 10), pl('NED', 'X. Simons', 'AVA', 7),
  ],
  MEX: [
    pl('MEX', 'Ochoa', 'GR', 13), pl('MEX', 'J. Sánchez', 'DEF', 3), pl('MEX', 'Montes', 'DEF', 5),
    pl('MEX', 'E. Álvarez', 'MED', 4), pl('MEX', 'Pineda', 'MED', 18),
    pl('MEX', 'H. Lozano', 'AVA', 22), pl('MEX', 'S. Giménez', 'AVA', 9),
  ],
  USA: [
    pl('USA', 'M. Turner', 'GR', 1), pl('USA', 'Dest', 'DEF', 2), pl('USA', 'A. Robinson', 'DEF', 5),
    pl('USA', 'Tyler Adams', 'MED', 4), pl('USA', 'McKennie', 'MED', 8),
    pl('USA', 'Pulisic', 'AVA', 10), pl('USA', 'Weah', 'AVA', 21), pl('USA', 'Balogun', 'AVA', 9),
  ],
  CRO: [
    pl('CRO', 'Livaković', 'GR', 1), pl('CRO', 'Gvardiol', 'DEF', 20), pl('CRO', 'Šutalo', 'DEF', 3),
    pl('CRO', 'Modrić', 'MED', 10), pl('CRO', 'Kovačić', 'MED', 8),
    pl('CRO', 'Kramarić', 'AVA', 9), pl('CRO', 'Perišić', 'AVA', 4),
  ],
};

export function squad(code: string): Footballer[] {
  return SQUADS[code] ?? [];
}

function mk(
  id: string,
  day: string,
  kickoff: string,
  stage: string,
  homeCode: string,
  awayCode: string,
  status: Match['status'],
  extra: Partial<Match> = {},
): Match {
  return {
    id,
    day,
    kickoff,
    stage,
    home: TEAMS[homeCode],
    away: TEAMS[awayCode],
    status,
    lineup: { home: squad(homeCode), away: squad(awayCode) },
    ...extra,
  };
}

export const MOCK_MATCHES: Match[] = [
  // ---- 16 jun (terminado) ----
  mk('m-por-cro', '2026-06-16', '2026-06-16T19:00:00Z', 'Grupo F', 'POR', 'CRO', 'finished', {
    homeGoals: 3, awayGoals: 0,
    ratings: { 'POR-7': 8.4, 'POR-8': 7.9, 'POR-15': 7.2, 'POR-3': 7.0, 'CRO-10': 7.5, 'CRO-9': 6.6 },
  }),
  mk('m-bra-mex', '2026-06-16', '2026-06-16T22:00:00Z', 'Grupo C', 'BRA', 'MEX', 'finished', {
    homeGoals: 2, awayGoals: 1,
    ratings: { 'BRA-20': 8.1, 'BRA-19': 7.6, 'BRA-1': 6.8, 'MEX-22': 7.0, 'MEX-9': 7.3 },
  }),
  // ---- 17 jun (terminado) ----
  mk('m-fra-esp', '2026-06-17', '2026-06-17T21:00:00Z', 'Grupo D', 'FRA', 'ESP', 'finished', {
    homeGoals: 2, awayGoals: 2,
    ratings: { 'ESP-19': 8.3, 'FRA-10': 8.0, 'ESP-8': 7.4, 'FRA-7': 7.1, 'ESP-7': 6.9 },
  }),
  // ---- 18 jun (hoje) ----
  mk('m-esp-mex', '2026-06-18', '2026-06-18T18:00:00Z', 'Grupo B', 'ESP', 'MEX', 'live', {
    minute: 57, homeGoals: 1, awayGoals: 0,
  }),
  mk('m-arg-usa', '2026-06-18', '2026-06-18T22:00:00Z', 'Grupo A', 'ARG', 'USA', 'upcoming'),
  mk('m-eng-ned', '2026-06-18', '2026-06-19T01:00:00Z', 'Grupo G', 'ENG', 'NED', 'upcoming'),
  // ---- 19 jun (amanhã) ----
  mk('m-fra-bra', '2026-06-19', '2026-06-19T19:00:00Z', 'Grupo D', 'FRA', 'BRA', 'upcoming'),
  mk('m-por-arg', '2026-06-19', '2026-06-19T22:00:00Z', 'Grupo F', 'POR', 'ARG', 'upcoming'),
];

/** Palpites já feitos nos dias terminados (para a tabela arrancar com números). */
export const MOCK_PICKS: Pick[] = [
  // 16 jun — POR x CRO
  p('ruben', 'm-por-cro', 'POR-7'), p('joao', 'm-por-cro', 'POR-8'),
  p('tiago', 'm-por-cro', 'CRO-10'), p('jaime', 'm-por-cro', 'POR-15'),
  // 16 jun — BRA x MEX
  p('ruben', 'm-bra-mex', 'BRA-20'), p('joao', 'm-bra-mex', 'BRA-19'),
  p('tiago', 'm-bra-mex', 'MEX-22'), p('jaime', 'm-bra-mex', 'BRA-1'),
  // 17 jun — FRA x ESP
  p('ruben', 'm-fra-esp', 'ESP-19'), p('joao', 'm-fra-esp', 'FRA-10'),
  p('tiago', 'm-fra-esp', 'ESP-8'), p('jaime', 'm-fra-esp', 'FRA-7'),
];

function p(friendId: string, matchId: string, footballerId: string): Pick {
  return { friendId, matchId, footballerId, at: '2026-06-16T00:00:00Z' };
}
