/**
 * Jogos reais do Mundial 2026 (calendário) + plantéis das seleções.
 * =================================================================
 * O calendário (FALLBACK_MATCHES) é a fonte base da app: a API-Football no
 * plano grátis não cobre 2026, por isso os jogos vêm daqui. As NOTAS e os
 * ONZES entram depois pelo painel de admin (importação manual → Supabase).
 *
 * Plantéis: 10 seleções "fortes" com onze provável aqui + as restantes em
 * squads2026.ts. Seleções sem plantel caem em nomes genéricos.
 */
import type { Footballer, Match, NationTeam, Pos } from './types';
import { EXTRA_SQUADS } from './squads2026';

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
  AUS: T('AUS', 'Austrália', '🇦🇺'),
  SCO: T('SCO', 'Escócia', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'),
  MAR: T('MAR', 'Marrocos', '🇲🇦'),
  HAI: T('HAI', 'Haiti', '🇭🇹'),
  TUR: T('TUR', 'Turquia', '🇹🇷'),
  PAR: T('PAR', 'Paraguai', '🇵🇾'),
  SWE: T('SWE', 'Suécia', '🇸🇪'),
  GER: T('GER', 'Alemanha', '🇩🇪'),
  CIV: T('CIV', 'Costa do Marfim', '🇨🇮'),
  ECU: T('ECU', 'Equador', '🇪🇨'),
  CUW: T('CUW', 'Curaçao', '🇨🇼'),
  TUN: T('TUN', 'Tunísia', '🇹🇳'),
  JPN: T('JPN', 'Japão', '🇯🇵'),
  KSA: T('KSA', 'Arábia Saudita', '🇸🇦'),
  BEL: T('BEL', 'Bélgica', '🇧🇪'),
  IRN: T('IRN', 'Irão', '🇮🇷'),
  URU: T('URU', 'Uruguai', '🇺🇾'),
  CPV: T('CPV', 'Cabo Verde', '🇨🇻'),
  NZL: T('NZL', 'Nova Zelândia', '🇳🇿'),
  EGY: T('EGY', 'Egito', '🇪🇬'),
  AUT: T('AUT', 'Áustria', '🇦🇹'),
  IRQ: T('IRQ', 'Iraque', '🇮🇶'),
  NOR: T('NOR', 'Noruega', '🇳🇴'),
  SEN: T('SEN', 'Senegal', '🇸🇳'),
  JOR: T('JOR', 'Jordânia', '🇯🇴'),
  ALG: T('ALG', 'Argélia', '🇩🇿'),
  UZB: T('UZB', 'Usbequistão', '🇺🇿'),
  GHA: T('GHA', 'Gana', '🇬🇭'),
  PAN: T('PAN', 'Panamá', '🇵🇦'),
  COL: T('COL', 'Colômbia', '🇨🇴'),
  COD: T('COD', 'RD Congo', '🇨🇩'),
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

/** Plantel de uma seleção (curado aqui, ou em squads2026, ou vazio). */
export function squad(code: string): Footballer[] {
  return SQUADS[code] ?? EXTRA_SQUADS[code] ?? [];
}

const GENERIC: Array<[Pos, string]> = [
  ['GR', 'Guarda-redes'],
  ['DEF', 'Defesa 1'], ['DEF', 'Defesa 2'], ['DEF', 'Defesa 3'], ['DEF', 'Defesa 4'],
  ['MED', 'Médio 1'], ['MED', 'Médio 2'], ['MED', 'Médio 3'],
  ['AVA', 'Avançado 1'], ['AVA', 'Avançado 2'], ['AVA', 'Avançado 3'],
];

/** Plantel real se existir; senão nomes genéricos (para a app ser jogável). */
function squadOrGeneric(code: string): Footballer[] {
  const s = squad(code);
  if (s.length > 0) return s;
  return GENERIC.map(([pos, name], i) => ({ id: `${code}-${i + 1}`, name, team: code, pos, number: i + 1 }));
}

function mk(id: string, day: string, time: string, homeCode: string, awayCode: string): Match {
  return {
    id,
    day,
    kickoff: `${day}T${time}:00+01:00`, // hora de Portugal (WEST, UTC+1)
    stage: 'Fase de grupos',
    home: TEAMS[homeCode],
    away: TEAMS[awayCode],
    status: 'upcoming',
    lineup: { home: squadOrGeneric(homeCode), away: squadOrGeneric(awayCode) },
  };
}

/** Calendário real do Mundial 2026 (hora de Portugal). */
export const FALLBACK_MATCHES: Match[] = [
  // ---- sexta 19 jun ----
  mk('wc-usa-aus', '2026-06-19', '20:00', 'USA', 'AUS'),
  mk('wc-sco-mar', '2026-06-19', '23:00', 'SCO', 'MAR'),
  // ---- sábado 20 jun ----
  mk('wc-bra-hai', '2026-06-20', '01:30', 'BRA', 'HAI'),
  mk('wc-tur-par', '2026-06-20', '04:00', 'TUR', 'PAR'),
  mk('wc-ned-swe', '2026-06-20', '18:00', 'NED', 'SWE'),
  mk('wc-ger-civ', '2026-06-20', '21:00', 'GER', 'CIV'),
  // ---- domingo 21 jun ----
  mk('wc-ecu-cuw', '2026-06-21', '01:00', 'ECU', 'CUW'),
  mk('wc-tun-jpn', '2026-06-21', '05:00', 'TUN', 'JPN'),
  mk('wc-esp-ksa', '2026-06-21', '17:00', 'ESP', 'KSA'),
  mk('wc-bel-irn', '2026-06-21', '20:00', 'BEL', 'IRN'),
  mk('wc-uru-cpv', '2026-06-21', '23:00', 'URU', 'CPV'),
  // ---- segunda 22 jun ----
  mk('wc-nzl-egy', '2026-06-22', '02:00', 'NZL', 'EGY'),
  mk('wc-arg-aut', '2026-06-22', '18:00', 'ARG', 'AUT'),
  mk('wc-fra-irq', '2026-06-22', '22:00', 'FRA', 'IRQ'),
  // ---- terça 23 jun ----
  mk('wc-nor-sen', '2026-06-23', '01:00', 'NOR', 'SEN'),
  mk('wc-jor-alg', '2026-06-23', '04:00', 'JOR', 'ALG'),
  mk('wc-por-uzb', '2026-06-23', '18:00', 'POR', 'UZB'),
  mk('wc-eng-gha', '2026-06-23', '21:00', 'ENG', 'GHA'),
  // ---- quarta 24 jun ----
  mk('wc-pan-cro', '2026-06-24', '00:00', 'PAN', 'CRO'),
  mk('wc-col-cod', '2026-06-24', '03:00', 'COL', 'COD'),
];
