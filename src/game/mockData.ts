/**
 * Plantéis (jogadores reais) por seleção — usados para preencher os candidatos
 * a escolher em cada jogo. Os JOGOS em si vêm da API-Football (ver
 * liveFixtures.ts); aqui ficam só os onzes prováveis das seleções conhecidas.
 * Seleções sem plantel aqui caem em nomes genéricos (Defesa 1, Médio 2, …).
 */
import type { Footballer, NationTeam, Pos } from './types';

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
