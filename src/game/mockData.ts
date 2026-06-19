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
import { footballDay } from './format';

const T = (code: string, name: string, cc: string, flag: string): NationTeam => ({ code, name, cc, flag });

export const TEAMS: Record<string, NationTeam> = {
  POR: T('POR', 'Portugal', 'pt', '🇵🇹'),
  ESP: T('ESP', 'Espanha', 'es', '🇪🇸'),
  BRA: T('BRA', 'Brasil', 'br', '🇧🇷'),
  ARG: T('ARG', 'Argentina', 'ar', '🇦🇷'),
  FRA: T('FRA', 'França', 'fr', '🇫🇷'),
  ENG: T('ENG', 'Inglaterra', 'gb-eng', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  NED: T('NED', 'Holanda', 'nl', '🇳🇱'),
  MEX: T('MEX', 'México', 'mx', '🇲🇽'),
  USA: T('USA', 'EUA', 'us', '🇺🇸'),
  CRO: T('CRO', 'Croácia', 'hr', '🇭🇷'),
  AUS: T('AUS', 'Austrália', 'au', '🇦🇺'),
  SCO: T('SCO', 'Escócia', 'gb-sct', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'),
  MAR: T('MAR', 'Marrocos', 'ma', '🇲🇦'),
  HAI: T('HAI', 'Haiti', 'ht', '🇭🇹'),
  TUR: T('TUR', 'Turquia', 'tr', '🇹🇷'),
  PAR: T('PAR', 'Paraguai', 'py', '🇵🇾'),
  SWE: T('SWE', 'Suécia', 'se', '🇸🇪'),
  GER: T('GER', 'Alemanha', 'de', '🇩🇪'),
  CIV: T('CIV', 'Costa do Marfim', 'ci', '🇨🇮'),
  ECU: T('ECU', 'Equador', 'ec', '🇪🇨'),
  CUW: T('CUW', 'Curaçao', 'cw', '🇨🇼'),
  TUN: T('TUN', 'Tunísia', 'tn', '🇹🇳'),
  JPN: T('JPN', 'Japão', 'jp', '🇯🇵'),
  KSA: T('KSA', 'Arábia Saudita', 'sa', '🇸🇦'),
  BEL: T('BEL', 'Bélgica', 'be', '🇧🇪'),
  IRN: T('IRN', 'Irão', 'ir', '🇮🇷'),
  URU: T('URU', 'Uruguai', 'uy', '🇺🇾'),
  CPV: T('CPV', 'Cabo Verde', 'cv', '🇨🇻'),
  NZL: T('NZL', 'Nova Zelândia', 'nz', '🇳🇿'),
  EGY: T('EGY', 'Egito', 'eg', '🇪🇬'),
  AUT: T('AUT', 'Áustria', 'at', '🇦🇹'),
  IRQ: T('IRQ', 'Iraque', 'iq', '🇮🇶'),
  NOR: T('NOR', 'Noruega', 'no', '🇳🇴'),
  SEN: T('SEN', 'Senegal', 'sn', '🇸🇳'),
  JOR: T('JOR', 'Jordânia', 'jo', '🇯🇴'),
  ALG: T('ALG', 'Argélia', 'dz', '🇩🇿'),
  UZB: T('UZB', 'Usbequistão', 'uz', '🇺🇿'),
  GHA: T('GHA', 'Gana', 'gh', '🇬🇭'),
  PAN: T('PAN', 'Panamá', 'pa', '🇵🇦'),
  COL: T('COL', 'Colômbia', 'co', '🇨🇴'),
  COD: T('COD', 'RD Congo', 'cd', '🇨🇩'),
  // Seleções extra (plantéis disponíveis; ainda sem jogos no calendário)
  RSA: T('RSA', 'África do Sul', 'za', '🇿🇦'),
  BIH: T('BIH', 'Bósnia', 'ba', '🇧🇦'),
  CAN: T('CAN', 'Canadá', 'ca', '🇨🇦'),
  QAT: T('QAT', 'Catar', 'qa', '🇶🇦'),
  KOR: T('KOR', 'Coreia do Sul', 'kr', '🇰🇷'),
  CZE: T('CZE', 'República Tcheca', 'cz', '🇨🇿'),
  SUI: T('SUI', 'Suíça', 'ch', '🇨🇭'),
};

/** Plantel real de uma seleção (convocatórias do Mundial 2026). */
export function squad(code: string): Footballer[] {
  return EXTRA_SQUADS[code] ?? [];
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

function mk(id: string, calDay: string, time: string, homeCode: string, awayCode: string): Match {
  const kickoff = `${calDay}T${time}:00+01:00`; // hora real de início (Portugal, WEST)
  return {
    id,
    day: footballDay(kickoff), // agrupa pelo "dia de futebol" (corte às 7h)
    kickoff,
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
