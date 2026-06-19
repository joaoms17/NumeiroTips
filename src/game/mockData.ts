/**
 * Dados FALLBACK do Mundial 2026 — usados quando a API-Football não devolve
 * jogos (ex.: plano grátis não cobre a época 2026). Mantém o jogo totalmente
 * jogável: jogos com datas/estados realistas, notas nos jogos terminados e
 * PLANTÉIS COMPLETOS (todos os convocados) para se poder escolher qualquer um.
 *
 * Os plantéis são indicativos (nomes reais, números podem variar). Quando a API
 * tiver dados reais (plano pago / época disponível), estes são substituídos.
 */
import type { Footballer, Match, NationTeam, Pos } from './types';

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
    pl('POR', 'Diogo Costa', 'GR', 22), pl('POR', 'Rui Patrício', 'GR', 1), pl('POR', 'José Sá', 'GR', 12),
    pl('POR', 'Diogo Dalot', 'DEF', 2), pl('POR', 'Rúben Dias', 'DEF', 3), pl('POR', 'Pepe', 'DEF', 4),
    pl('POR', 'Nuno Mendes', 'DEF', 19), pl('POR', 'Cancelo', 'DEF', 20), pl('POR', 'António Silva', 'DEF', 24),
    pl('POR', 'Gonçalo Inácio', 'DEF', 14), pl('POR', 'Nélson Semedo', 'DEF', 13),
    pl('POR', 'João Palhinha', 'MED', 6), pl('POR', 'Bruno F.', 'MED', 8), pl('POR', 'Bernardo Silva', 'MED', 10),
    pl('POR', 'Vitinha', 'MED', 16), pl('POR', 'Rúben Neves', 'MED', 18), pl('POR', 'João Neves', 'MED', 25),
    pl('POR', 'Otávio', 'MED', 23),
    pl('POR', 'Ronaldo', 'AVA', 7), pl('POR', 'João Félix', 'AVA', 11), pl('POR', 'Rafael Leão', 'AVA', 15),
    pl('POR', 'Pedro Neto', 'AVA', 17), pl('POR', 'Diogo Jota', 'AVA', 21), pl('POR', 'Gonçalo Ramos', 'AVA', 26),
  ],
  ESP: [
    pl('ESP', 'Unai Simón', 'GR', 23), pl('ESP', 'David Raya', 'GR', 13), pl('ESP', 'Robert Sánchez', 'GR', 1),
    pl('ESP', 'Carvajal', 'DEF', 2), pl('ESP', 'Le Normand', 'DEF', 3), pl('ESP', 'Laporte', 'DEF', 14),
    pl('ESP', 'Cucurella', 'DEF', 24), pl('ESP', 'Pedro Porro', 'DEF', 4), pl('ESP', 'Dani Vivian', 'DEF', 5),
    pl('ESP', 'Grimaldo', 'DEF', 18), pl('ESP', 'Alejandro Balde', 'DEF', 22),
    pl('ESP', 'Rodri', 'MED', 16), pl('ESP', 'Pedri', 'MED', 8), pl('ESP', 'Fabián Ruiz', 'MED', 12),
    pl('ESP', 'Mikel Merino', 'MED', 6), pl('ESP', 'Zubimendi', 'MED', 17), pl('ESP', 'Dani Olmo', 'MED', 10),
    pl('ESP', 'Yamal', 'AVA', 19), pl('ESP', 'N. Williams', 'AVA', 11), pl('ESP', 'Morata', 'AVA', 7),
    pl('ESP', 'Ferran Torres', 'AVA', 9), pl('ESP', 'Oyarzabal', 'AVA', 21), pl('ESP', 'Ayoze Pérez', 'AVA', 20),
  ],
  BRA: [
    pl('BRA', 'Alisson', 'GR', 1), pl('BRA', 'Ederson', 'GR', 12), pl('BRA', 'Bento', 'GR', 23),
    pl('BRA', 'Danilo', 'DEF', 2), pl('BRA', 'Marquinhos', 'DEF', 4), pl('BRA', 'Gabriel Magalhães', 'DEF', 3),
    pl('BRA', 'Éder Militão', 'DEF', 14), pl('BRA', 'Wendell', 'DEF', 6), pl('BRA', 'Vanderson', 'DEF', 13),
    pl('BRA', 'Beraldo', 'DEF', 24), pl('BRA', 'Caio Henrique', 'DEF', 16),
    pl('BRA', 'Bruno Guimarães', 'MED', 5), pl('BRA', 'Paquetá', 'MED', 7), pl('BRA', 'Gerson', 'MED', 15),
    pl('BRA', 'André', 'MED', 17), pl('BRA', 'João Gomes', 'MED', 8),
    pl('BRA', 'Vinícius Jr', 'AVA', 20), pl('BRA', 'Rodrygo', 'AVA', 10), pl('BRA', 'Raphinha', 'AVA', 19),
    pl('BRA', 'Endrick', 'AVA', 9), pl('BRA', 'Savinho', 'AVA', 11), pl('BRA', 'Igor Jesus', 'AVA', 21),
    pl('BRA', 'Estêvão', 'AVA', 18),
  ],
  ARG: [
    pl('ARG', 'E. Martínez', 'GR', 23), pl('ARG', 'Gerónimo Rulli', 'GR', 12), pl('ARG', 'Walter Benítez', 'GR', 1),
    pl('ARG', 'Nahuel Molina', 'DEF', 26), pl('ARG', 'Cuti Romero', 'DEF', 13), pl('ARG', 'Lisandro Martínez', 'DEF', 25),
    pl('ARG', 'Otamendi', 'DEF', 19), pl('ARG', 'Tagliafico', 'DEF', 3), pl('ARG', 'Marcos Acuña', 'DEF', 8),
    pl('ARG', 'Gonzalo Montiel', 'DEF', 4), pl('ARG', 'Leonardo Balerdi', 'DEF', 2),
    pl('ARG', 'De Paul', 'MED', 7), pl('ARG', 'Enzo Fernández', 'MED', 24), pl('ARG', 'Mac Allister', 'MED', 20),
    pl('ARG', 'Leandro Paredes', 'MED', 5), pl('ARG', 'Lo Celso', 'MED', 18),
    pl('ARG', 'Messi', 'AVA', 10), pl('ARG', 'Julián Álvarez', 'AVA', 9), pl('ARG', 'Lautaro Martínez', 'AVA', 22),
    pl('ARG', 'Di María', 'AVA', 11), pl('ARG', 'Nico González', 'AVA', 21), pl('ARG', 'Dybala', 'AVA', 16),
    pl('ARG', 'Garnacho', 'AVA', 15),
  ],
  FRA: [
    pl('FRA', 'Maignan', 'GR', 16), pl('FRA', 'Areola', 'GR', 23), pl('FRA', 'Brice Samba', 'GR', 1),
    pl('FRA', 'Pavard', 'DEF', 2), pl('FRA', 'Upamecano', 'DEF', 4), pl('FRA', 'Koundé', 'DEF', 5),
    pl('FRA', 'Saliba', 'DEF', 17), pl('FRA', 'Konaté', 'DEF', 18), pl('FRA', 'T. Hernández', 'DEF', 22),
    pl('FRA', 'L. Hernández', 'DEF', 21), pl('FRA', 'Digne', 'DEF', 24),
    pl('FRA', 'Tchouaméni', 'MED', 8), pl('FRA', 'Camavinga', 'MED', 6), pl('FRA', 'Rabiot', 'MED', 14),
    pl('FRA', 'Fofana', 'MED', 13), pl('FRA', 'Griezmann', 'MED', 7),
    pl('FRA', 'Mbappé', 'AVA', 10), pl('FRA', 'Dembélé', 'AVA', 11), pl('FRA', 'Thuram', 'AVA', 15),
    pl('FRA', 'Kolo Muani', 'AVA', 12), pl('FRA', 'Barcola', 'AVA', 20), pl('FRA', 'Olise', 'AVA', 9),
    pl('FRA', 'Coman', 'AVA', 25),
  ],
  ENG: [
    pl('ENG', 'Pickford', 'GR', 1), pl('ENG', 'Dean Henderson', 'GR', 13), pl('ENG', 'Ramsdale', 'GR', 23),
    pl('ENG', 'Walker', 'DEF', 2), pl('ENG', 'Stones', 'DEF', 5), pl('ENG', 'Guéhi', 'DEF', 6),
    pl('ENG', 'Trippier', 'DEF', 12), pl('ENG', 'Trent A.-Arnold', 'DEF', 24), pl('ENG', 'Dunk', 'DEF', 15),
    pl('ENG', 'Luke Shaw', 'DEF', 3), pl('ENG', 'Reece James', 'DEF', 22),
    pl('ENG', 'Rice', 'MED', 4), pl('ENG', 'Bellingham', 'MED', 10), pl('ENG', 'Foden', 'MED', 20),
    pl('ENG', 'Mainoo', 'MED', 26), pl('ENG', 'Palmer', 'MED', 21),
    pl('ENG', 'Kane', 'AVA', 9), pl('ENG', 'Saka', 'AVA', 7), pl('ENG', 'Grealish', 'AVA', 11),
    pl('ENG', 'Gordon', 'AVA', 25), pl('ENG', 'Watkins', 'AVA', 18), pl('ENG', 'Rashford', 'AVA', 19),
    pl('ENG', 'Bowen', 'AVA', 17),
  ],
  NED: [
    pl('NED', 'Verbruggen', 'GR', 1), pl('NED', 'Flekken', 'GR', 13), pl('NED', 'Bijlow', 'GR', 23),
    pl('NED', 'Dumfries', 'DEF', 22), pl('NED', 'Van Dijk', 'DEF', 4), pl('NED', 'De Vrij', 'DEF', 3),
    pl('NED', 'Aké', 'DEF', 5), pl('NED', 'Geertruida', 'DEF', 2), pl('NED', 'Hartman', 'DEF', 16),
    pl('NED', 'Hato', 'DEF', 17), pl('NED', 'Timber', 'DEF', 24),
    pl('NED', 'De Jong', 'MED', 21), pl('NED', 'Reijnders', 'MED', 18), pl('NED', 'Schouten', 'MED', 6),
    pl('NED', 'Wieffer', 'MED', 15), pl('NED', 'Veerman', 'MED', 8),
    pl('NED', 'Depay', 'AVA', 10), pl('NED', 'X. Simons', 'AVA', 7), pl('NED', 'Gakpo', 'AVA', 11),
    pl('NED', 'Brobbey', 'AVA', 9), pl('NED', 'Malen', 'AVA', 12), pl('NED', 'Weghorst', 'AVA', 19),
    pl('NED', 'Lang', 'AVA', 20),
  ],
  MEX: [
    pl('MEX', 'Ochoa', 'GR', 13), pl('MEX', 'Malagón', 'GR', 1), pl('MEX', 'Rangel', 'GR', 23),
    pl('MEX', 'J. Sánchez', 'DEF', 3), pl('MEX', 'César Montes', 'DEF', 5), pl('MEX', 'Johan Vásquez', 'DEF', 4),
    pl('MEX', 'Gallardo', 'DEF', 25), pl('MEX', 'Arteaga', 'DEF', 21), pl('MEX', 'Kevin Álvarez', 'DEF', 2),
    pl('MEX', 'Israel Reyes', 'DEF', 6), pl('MEX', 'Julián Araujo', 'DEF', 19),
    pl('MEX', 'Edson Álvarez', 'MED', 16), pl('MEX', 'Luis Chávez', 'MED', 14), pl('MEX', 'Erik Lira', 'MED', 8),
    pl('MEX', 'Orbelín Pineda', 'MED', 10), pl('MEX', 'Luis Romo', 'MED', 18),
    pl('MEX', 'H. Lozano', 'AVA', 22), pl('MEX', 'S. Giménez', 'AVA', 9), pl('MEX', 'Raúl Jiménez', 'AVA', 7),
    pl('MEX', 'Alexis Vega', 'AVA', 11), pl('MEX', 'Roberto Alvarado', 'AVA', 20), pl('MEX', 'Uriel Antuna', 'AVA', 12),
    pl('MEX', 'Henry Martín', 'AVA', 15),
  ],
  USA: [
    pl('USA', 'M. Turner', 'GR', 1), pl('USA', 'Ethan Horvath', 'GR', 12), pl('USA', 'Patrick Schulte', 'GR', 23),
    pl('USA', 'Sergiño Dest', 'DEF', 2), pl('USA', 'A. Robinson', 'DEF', 5), pl('USA', 'Chris Richards', 'DEF', 3),
    pl('USA', 'Tim Ream', 'DEF', 13), pl('USA', 'Joe Scally', 'DEF', 19), pl('USA', 'Carter-Vickers', 'DEF', 15),
    pl('USA', 'Miles Robinson', 'DEF', 4), pl('USA', 'DeJuan Jones', 'DEF', 24),
    pl('USA', 'Tyler Adams', 'MED', 14), pl('USA', 'McKennie', 'MED', 8), pl('USA', 'Yunus Musah', 'MED', 6),
    pl('USA', 'Tanner Tessmann', 'MED', 18), pl('USA', 'Johnny Cardoso', 'MED', 20),
    pl('USA', 'Pulisic', 'AVA', 10), pl('USA', 'Weah', 'AVA', 21), pl('USA', 'Balogun', 'AVA', 9),
    pl('USA', 'Ricardo Pepi', 'AVA', 16), pl('USA', 'Aaronson', 'AVA', 11), pl('USA', 'Gio Reyna', 'AVA', 7),
    pl('USA', 'Haji Wright', 'AVA', 17),
  ],
  CRO: [
    pl('CRO', 'Livaković', 'GR', 1), pl('CRO', 'Ivušić', 'GR', 12), pl('CRO', 'Labrović', 'GR', 23),
    pl('CRO', 'Stanišić', 'DEF', 2), pl('CRO', 'Gvardiol', 'DEF', 20), pl('CRO', 'Šutalo', 'DEF', 3),
    pl('CRO', 'Ćaleta-Car', 'DEF', 5), pl('CRO', 'Juranović', 'DEF', 22), pl('CRO', 'Sosa', 'DEF', 19),
    pl('CRO', 'Pongračić', 'DEF', 6), pl('CRO', 'Erlić', 'DEF', 24),
    pl('CRO', 'Modrić', 'MED', 10), pl('CRO', 'Kovačić', 'MED', 8), pl('CRO', 'Brozović', 'MED', 11),
    pl('CRO', 'Pašalić', 'MED', 15), pl('CRO', 'Sučić', 'MED', 26), pl('CRO', 'Majer', 'MED', 14),
    pl('CRO', 'Kramarić', 'AVA', 9), pl('CRO', 'Perišić', 'AVA', 4), pl('CRO', 'Budimir', 'AVA', 17),
    pl('CRO', 'Petković', 'AVA', 16), pl('CRO', 'Vlašić', 'AVA', 13), pl('CRO', 'Baturina', 'AVA', 25),
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

/** Jogos fallback do Mundial 2026 (terminados com notas + ao vivo + por jogar). */
export const FALLBACK_MATCHES: Match[] = [
  // ---- 16 jun (terminado) ----
  mk('fb-por-cro', '2026-06-16', '2026-06-16T19:00:00Z', 'Grupo F', 'POR', 'CRO', 'finished', {
    homeGoals: 3, awayGoals: 0,
    ratings: {
      'POR-7': 8.4, 'POR-8': 7.9, 'POR-15': 7.2, 'POR-3': 7.0, 'POR-16': 7.5,
      'CRO-10': 7.5, 'CRO-9': 6.6, 'CRO-1': 6.8,
    },
  }),
  mk('fb-bra-mex', '2026-06-16', '2026-06-16T22:00:00Z', 'Grupo C', 'BRA', 'MEX', 'finished', {
    homeGoals: 2, awayGoals: 1,
    ratings: {
      'BRA-20': 8.1, 'BRA-10': 7.6, 'BRA-19': 7.4, 'BRA-1': 6.8,
      'MEX-22': 7.0, 'MEX-9': 7.3, 'MEX-13': 6.5,
    },
  }),
  // ---- 17 jun (terminado) ----
  mk('fb-fra-esp', '2026-06-17', '2026-06-17T21:00:00Z', 'Grupo D', 'FRA', 'ESP', 'finished', {
    homeGoals: 2, awayGoals: 2,
    ratings: {
      'ESP-19': 8.3, 'FRA-10': 8.0, 'ESP-8': 7.4, 'FRA-7': 7.1, 'ESP-7': 6.9,
      'FRA-11': 7.3, 'ESP-16': 7.8,
    },
  }),
  mk('fb-arg-usa', '2026-06-17', '2026-06-17T23:00:00Z', 'Grupo A', 'ARG', 'USA', 'finished', {
    homeGoals: 1, awayGoals: 0,
    ratings: {
      'ARG-10': 8.2, 'ARG-9': 7.6, 'ARG-23': 7.0, 'ARG-13': 7.2,
      'USA-10': 7.1, 'USA-9': 6.4,
    },
  }),
  // ---- 18 jun (terminado) ----
  mk('fb-eng-ned', '2026-06-18', '2026-06-18T21:00:00Z', 'Grupo E', 'ENG', 'NED', 'finished', {
    homeGoals: 2, awayGoals: 1,
    ratings: {
      'ENG-9': 7.8, 'ENG-10': 8.1, 'ENG-7': 7.5, 'ENG-1': 6.7,
      'NED-10': 7.0, 'NED-7': 7.3, 'NED-4': 6.9,
    },
  }),
  // ---- 19 jun (hoje) ----
  mk('fb-esp-mex', '2026-06-19', '2026-06-19T18:00:00Z', 'Grupo B', 'ESP', 'MEX', 'live', {
    minute: 57, homeGoals: 1, awayGoals: 0,
  }),
  mk('fb-fra-bra', '2026-06-19', '2026-06-19T20:00:00Z', 'Grupo D', 'FRA', 'BRA', 'upcoming'),
  mk('fb-por-arg', '2026-06-19', '2026-06-19T22:00:00Z', 'Grupo F', 'POR', 'ARG', 'upcoming'),
  // ---- 20 jun (amanhã) ----
  mk('fb-eng-usa', '2026-06-20', '2026-06-20T19:00:00Z', 'Grupo E', 'ENG', 'USA', 'upcoming'),
  mk('fb-ned-cro', '2026-06-20', '2026-06-20T22:00:00Z', 'Grupo G', 'NED', 'CRO', 'upcoming'),
  // ---- 21 jun ----
  mk('fb-bra-esp', '2026-06-21', '2026-06-21T19:00:00Z', 'Grupo C', 'BRA', 'ESP', 'upcoming'),
  mk('fb-arg-mex', '2026-06-21', '2026-06-21T22:00:00Z', 'Grupo A', 'ARG', 'MEX', 'upcoming'),
];
