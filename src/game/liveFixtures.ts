/**
 * Jogos reais do Mundial 2026 via API-Football (proxy Vercel).
 * Cache adaptativo: 5 min se houver jogo ao vivo, 15 min caso contrário.
 * Custa 1 pedido à quota de 100/dia.
 */
import type { Footballer, Match, NationTeam } from './types';
import { squad as mockSquad } from './mockData';

const CACHE_KEY = 'af:wc2026:v1';

const LIVE_ST = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']);
const DONE_ST = new Set(['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO']);

interface CacheEntry { exp: number; matches: Match[] }

function cacheLoad(): Match[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw) as CacheEntry;
    return Date.now() < e.exp ? e.matches : null;
  } catch { return null; }
}

function cacheSave(matches: Match[]) {
  const hasLive = matches.some((m) => m.status === 'live');
  const ttl = hasLive ? 5 * 60_000 : 15 * 60_000;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ exp: Date.now() + ttl, matches })); }
  catch { /* ignore */ }
}

/** Limpa o cache para forçar re-fetch no próximo arranque. */
export function clearFixturesCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

const TEAM_MAP: Record<string, { code: string; name: string; flag: string }> = {
  // UEFA
  Portugal: { code: 'POR', name: 'Portugal', flag: '🇵🇹' },
  Spain: { code: 'ESP', name: 'Espanha', flag: '🇪🇸' },
  France: { code: 'FRA', name: 'França', flag: '🇫🇷' },
  England: { code: 'ENG', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  Germany: { code: 'GER', name: 'Alemanha', flag: '🇩🇪' },
  Italy: { code: 'ITA', name: 'Itália', flag: '🇮🇹' },
  Netherlands: { code: 'NED', name: 'Holanda', flag: '🇳🇱' },
  Belgium: { code: 'BEL', name: 'Bélgica', flag: '🇧🇪' },
  Croatia: { code: 'CRO', name: 'Croácia', flag: '🇭🇷' },
  Switzerland: { code: 'SUI', name: 'Suíça', flag: '🇨🇭' },
  Austria: { code: 'AUT', name: 'Áustria', flag: '🇦🇹' },
  Denmark: { code: 'DEN', name: 'Dinamarca', flag: '🇩🇰' },
  Serbia: { code: 'SRB', name: 'Sérvia', flag: '🇷🇸' },
  Turkey: { code: 'TUR', name: 'Turquia', flag: '🇹🇷' },
  Scotland: { code: 'SCO', name: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  Czechia: { code: 'CZE', name: 'Chéquia', flag: '🇨🇿' },
  'Czech Republic': { code: 'CZE', name: 'Chéquia', flag: '🇨🇿' },
  Poland: { code: 'POL', name: 'Polónia', flag: '🇵🇱' },
  Ukraine: { code: 'UKR', name: 'Ucrânia', flag: '🇺🇦' },
  Hungary: { code: 'HUN', name: 'Hungria', flag: '🇭🇺' },
  Slovakia: { code: 'SVK', name: 'Eslováquia', flag: '🇸🇰' },
  Slovenia: { code: 'SVN', name: 'Eslovénia', flag: '🇸🇮' },
  Albania: { code: 'ALB', name: 'Albânia', flag: '🇦🇱' },
  Romania: { code: 'ROU', name: 'Roménia', flag: '🇷🇴' },
  Greece: { code: 'GRE', name: 'Grécia', flag: '🇬🇷' },
  Wales: { code: 'WAL', name: 'País de Gales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  Norway: { code: 'NOR', name: 'Noruega', flag: '🇳🇴' },
  Finland: { code: 'FIN', name: 'Finlândia', flag: '🇫🇮' },
  Iceland: { code: 'ISL', name: 'Islândia', flag: '🇮🇸' },
  // CONMEBOL
  Argentina: { code: 'ARG', name: 'Argentina', flag: '🇦🇷' },
  Brazil: { code: 'BRA', name: 'Brasil', flag: '🇧🇷' },
  Uruguay: { code: 'URU', name: 'Uruguai', flag: '🇺🇾' },
  Colombia: { code: 'COL', name: 'Colômbia', flag: '🇨🇴' },
  Ecuador: { code: 'ECU', name: 'Equador', flag: '🇪🇨' },
  Chile: { code: 'CHI', name: 'Chile', flag: '🇨🇱' },
  Paraguay: { code: 'PAR', name: 'Paraguai', flag: '🇵🇾' },
  Peru: { code: 'PER', name: 'Peru', flag: '🇵🇪' },
  Venezuela: { code: 'VEN', name: 'Venezuela', flag: '🇻🇪' },
  Bolivia: { code: 'BOL', name: 'Bolívia', flag: '🇧🇴' },
  // CONCACAF
  USA: { code: 'USA', name: 'EUA', flag: '🇺🇸' },
  Mexico: { code: 'MEX', name: 'México', flag: '🇲🇽' },
  Canada: { code: 'CAN', name: 'Canadá', flag: '🇨🇦' },
  'Costa Rica': { code: 'CRC', name: 'Costa Rica', flag: '🇨🇷' },
  Panama: { code: 'PAN', name: 'Panamá', flag: '🇵🇦' },
  Jamaica: { code: 'JAM', name: 'Jamaica', flag: '🇯🇲' },
  Honduras: { code: 'HON', name: 'Honduras', flag: '🇭🇳' },
  Guatemala: { code: 'GUA', name: 'Guatemala', flag: '🇬🇹' },
  'El Salvador': { code: 'SLV', name: 'El Salvador', flag: '🇸🇻' },
  Cuba: { code: 'CUB', name: 'Cuba', flag: '🇨🇺' },
  'Trinidad and Tobago': { code: 'TRI', name: 'Trinidad e Tobago', flag: '🇹🇹' },
  // CAF
  Morocco: { code: 'MAR', name: 'Marrocos', flag: '🇲🇦' },
  Senegal: { code: 'SEN', name: 'Senegal', flag: '🇸🇳' },
  Nigeria: { code: 'NGA', name: 'Nigéria', flag: '🇳🇬' },
  Ghana: { code: 'GHA', name: 'Gana', flag: '🇬🇭' },
  Cameroon: { code: 'CMR', name: 'Camarões', flag: '🇨🇲' },
  'Ivory Coast': { code: 'CIV', name: 'Costa do Marfim', flag: '🇨🇮' },
  "Cote d'Ivoire": { code: 'CIV', name: 'Costa do Marfim', flag: '🇨🇮' },
  "Côte d'Ivoire": { code: 'CIV', name: 'Costa do Marfim', flag: '🇨🇮' },
  Egypt: { code: 'EGY', name: 'Egito', flag: '🇪🇬' },
  Algeria: { code: 'ALG', name: 'Argélia', flag: '🇩🇿' },
  Tunisia: { code: 'TUN', name: 'Tunísia', flag: '🇹🇳' },
  Mali: { code: 'MLI', name: 'Mali', flag: '🇲🇱' },
  'South Africa': { code: 'RSA', name: 'África do Sul', flag: '🇿🇦' },
  'DR Congo': { code: 'COD', name: 'RD Congo', flag: '🇨🇩' },
  Congo: { code: 'CGO', name: 'Congo', flag: '🇨🇬' },
  Tanzania: { code: 'TAN', name: 'Tanzânia', flag: '🇹🇿' },
  Zambia: { code: 'ZAM', name: 'Zâmbia', flag: '🇿🇲' },
  'Cape Verde': { code: 'CPV', name: 'Cabo Verde', flag: '🇨🇻' },
  Angola: { code: 'ANG', name: 'Angola', flag: '🇦🇴' },
  Uganda: { code: 'UGA', name: 'Uganda', flag: '🇺🇬' },
  Benin: { code: 'BEN', name: 'Benim', flag: '🇧🇯' },
  'Burkina Faso': { code: 'BFA', name: 'Burkina Faso', flag: '🇧🇫' },
  Guinea: { code: 'GUI', name: 'Guiné', flag: '🇬🇳' },
  Gabon: { code: 'GAB', name: 'Gabão', flag: '🇬🇦' },
  Mozambique: { code: 'MOZ', name: 'Moçambique', flag: '🇲🇿' },
  // AFC
  Japan: { code: 'JPN', name: 'Japão', flag: '🇯🇵' },
  'South Korea': { code: 'KOR', name: 'Coreia do Sul', flag: '🇰🇷' },
  'Korea Republic': { code: 'KOR', name: 'Coreia do Sul', flag: '🇰🇷' },
  Australia: { code: 'AUS', name: 'Austrália', flag: '🇦🇺' },
  'Saudi Arabia': { code: 'KSA', name: 'Arábia Saudita', flag: '🇸🇦' },
  Iran: { code: 'IRN', name: 'Irão', flag: '🇮🇷' },
  Qatar: { code: 'QAT', name: 'Qatar', flag: '🇶🇦' },
  Iraq: { code: 'IRQ', name: 'Iraque', flag: '🇮🇶' },
  'United Arab Emirates': { code: 'UAE', name: 'Emirados Árabes', flag: '🇦🇪' },
  'China PR': { code: 'CHN', name: 'China', flag: '🇨🇳' },
  China: { code: 'CHN', name: 'China', flag: '🇨🇳' },
  Uzbekistan: { code: 'UZB', name: 'Usbequistão', flag: '🇺🇿' },
  Oman: { code: 'OMA', name: 'Omã', flag: '🇴🇲' },
  Jordan: { code: 'JOR', name: 'Jordânia', flag: '🇯🇴' },
  Indonesia: { code: 'IDN', name: 'Indonésia', flag: '🇮🇩' },
  // OFC
  'New Zealand': { code: 'NZL', name: 'Nova Zelândia', flag: '🇳🇿' },
};

function teamFor(apiName: string): NationTeam {
  return TEAM_MAP[apiName] ?? { code: apiName.replace(/\s+/g, '').toUpperCase().slice(0, 3), name: apiName, flag: '🏳️' };
}

const GENERIC_POS: Array<[Footballer['pos'], string]> = [
  ['GR', 'Guarda-redes'],
  ['DEF', 'Defesa 1'], ['DEF', 'Defesa 2'], ['DEF', 'Defesa 3'],
  ['MED', 'Médio 1'], ['MED', 'Médio 2'],
  ['AVA', 'Avançado 1'], ['AVA', 'Avançado 2'],
];

function squadFor(code: string): Footballer[] {
  const existing = mockSquad(code);
  if (existing.length > 0) return existing;
  return GENERIC_POS.map(([pos, name], i) => ({
    id: `${code}-${i + 1}`, name, team: code, pos, number: i + 1,
  }));
}

interface AFFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  league: { round: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
}

function toMatch(f: AFFixture): Match {
  const home = teamFor(f.teams.home.name);
  const away = teamFor(f.teams.away.name);
  const st = f.fixture.status.short;
  const status: Match['status'] = DONE_ST.has(st) ? 'finished' : LIVE_ST.has(st) ? 'live' : 'upcoming';
  return {
    id: `af-${f.fixture.id}`,
    day: f.fixture.date.slice(0, 10),
    kickoff: f.fixture.date,
    stage: f.league.round,
    home,
    away,
    status,
    minute: status === 'live' ? (f.fixture.status.elapsed ?? undefined) : undefined,
    homeGoals: f.goals.home ?? undefined,
    awayGoals: f.goals.away ?? undefined,
    lineup: { home: squadFor(home.code), away: squadFor(away.code) },
  };
}

export async function loadLiveFixtures(): Promise<Match[]> {
  const cached = cacheLoad();
  if (cached) return cached;

  const now = new Date();
  const from = new Date(now.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);

  const path = `/fixtures?league=1&season=2026&from=${from}&to=${to}`;
  const res = await fetch(`/api/football?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { response?: AFFixture[]; errors?: unknown };
  const errs = json.errors;
  if (errs && typeof errs === 'object') {
    const msg = Object.values(errs as Record<string, string>).filter(Boolean).join('; ');
    if (msg) throw new Error(msg);
  }
  const matches = (json.response ?? []).map(toMatch);
  if (matches.length > 0) cacheSave(matches);
  return matches;
}
