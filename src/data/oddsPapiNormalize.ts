/**
 * Normalização OddsPapi → MarketSnapshot[]
 * =======================================
 *
 * A OddsPapi expõe odds numa estrutura aninhada (confirmada na documentação
 * pública):
 *
 *     resposta.bookmakerOdds[<bookmaker>].markets[<marketId>].outcomes[]
 *
 * e os eventos ("fixtures") num endpoint separado. Este módulo traduz essa
 * estrutura para o nosso `MarketSnapshot`, que o motor consome.
 *
 * ⚠️ CAMPOS A CONFIRMAR (ver TODO):
 * Os NOMES EXATOS de alguns campos dependem do plano/versão OddsPapi e não
 * foram verificáveis a partir deste ambiente (docs B2B autenticadas + egress
 * restrito). Por isso toda a incerteza está isolada nas três funções/tabelas
 * marcadas com TODO: `BOOKMAKER_SLUGS`, `mapMarket` e `readOutcome`. Cola um
 * exemplo real de `/odds?fixtureId=...` e ajusta SÓ aí — o resto não muda.
 */
import type {
  MarketSnapshot,
  SportEvent,
  Selection,
  OddQuote,
  BookId,
  MarketType,
} from '../lib/types';

// ---- Tipos "soltos" da resposta OddsPapi (o que esperamos receber) ----------
export interface OddsPapiFixture {
  id: string | number;
  sport?: string;
  league?: { name?: string } | string;
  homeTeam?: { name?: string } | string;
  awayTeam?: { name?: string } | string;
  startTime?: string;
  // alguns planos usam estes nomes alternativos:
  home?: string;
  away?: string;
  commenceTime?: string;
}

export interface OddsPapiOutcome {
  // TODO(confirmar): preço pode vir como `price`, `odds`, `value` ou `decimal`.
  price?: number;
  odds?: number;
  value?: number;
  decimal?: number;
  // TODO(confirmar): seleção pode vir como `name`, `label`, `selection`, `type`.
  name?: string;
  label?: string;
  selection?: string;
  type?: string;
  // linha (handicap/total): `line`, `handicap`, `points`.
  line?: number;
  handicap?: number;
  points?: number;
  // liquidez (exchanges)
  volume?: number;
  liquidity?: number;
}

export interface OddsPapiMarket {
  outcomes?: OddsPapiOutcome[];
  // alguns planos enviam o tipo/linha ao nível do mercado:
  type?: string;
  name?: string;
  line?: number;
}

export interface OddsPapiOddsResponse {
  fixtureId?: string | number;
  bookmakerOdds?: Record<string, { markets?: Record<string, OddsPapiMarket> }>;
}

// ---- Mapeamentos (a parte ajustável) ----------------------------------------

/**
 * TODO(confirmar): slugs reais da OddsPapi para as nossas casas. Incluem-se
 * variantes comuns; mapeia qualquer alias que apareça no exemplo real.
 */
const BOOKMAKER_SLUGS: Record<string, BookId> = {
  pinnacle: 'pinnacle',
  pinnaclesports: 'pinnacle',
  betfair: 'betfair',
  betfair_ex: 'betfair',
  betfairexchange: 'betfair',
  betclic: 'betclic',
  '1xbet': '1xbet',
  onexbet: '1xbet',
};

/** Resolve um slug OddsPapi (case-insensitive) para o nosso BookId, ou null. */
function mapBookmaker(slug: string): BookId | null {
  const key = slug.toLowerCase().replace(/[\s_-]/g, '');
  // tenta exato e depois sem separadores
  return BOOKMAKER_SLUGS[slug.toLowerCase()] ?? BOOKMAKER_SLUGS[key] ?? null;
}

/**
 * TODO(confirmar): mapeia o id/nome de mercado OddsPapi para o nosso
 * MarketType + linha. Cobrimos os 3 mercados do MVP (1X2, Over/Under 2.5, BTTS).
 */
function mapMarket(marketId: string, market: OddsPapiMarket): { type: MarketType; line: number | null } | null {
  const id = `${market.type ?? market.name ?? marketId}`.toLowerCase();
  const line = market.line ?? market.outcomes?.[0]?.line ?? null;

  if (/(^|[^a-z])(1x2|moneyline_?3way|match_?odds|fulltimeresult)/.test(id)) {
    return { type: '1x2', line: null };
  }
  if (/(over_?under|totals|total_?goals|goals_?ou)/.test(id)) {
    return { type: 'over_under', line: line ?? 2.5 };
  }
  if (/(btts|both_?teams_?to_?score|goal_?goal)/.test(id)) {
    return { type: 'btts', line: null };
  }
  // mercados ainda não suportados no MVP
  return null;
}

/** TODO(confirmar): lê preço/seleção/linha de um outcome com fallbacks. */
function readOutcome(o: OddsPapiOutcome): { sel: string; odd: number; line: number | null; volume?: number } | null {
  const odd = o.price ?? o.odds ?? o.value ?? o.decimal;
  const sel = (o.name ?? o.label ?? o.selection ?? o.type ?? '').toString();
  const line = o.line ?? o.handicap ?? o.points ?? null;
  const volume = o.volume ?? o.liquidity;
  if (!sel || !(typeof odd === 'number' && odd > 1)) return null;
  return { sel, odd, line, volume };
}

/**
 * Canoniza o nome de uma seleção para o nosso slug estável, por mercado.
 * Ex.: "1"/"Home"/<equipa casa> → "home".
 */
function selectionSlug(
  market: MarketType,
  rawName: string,
  home: string,
  away: string,
): string | null {
  const n = rawName.trim().toLowerCase();
  if (market === '1x2') {
    if (n === '1' || n === 'home' || n === '1x' || n === home.toLowerCase()) return 'home';
    if (n === 'x' || n === 'draw' || n === 'empate') return 'draw';
    if (n === '2' || n === 'away' || n === away.toLowerCase()) return 'away';
    return null;
  }
  if (market === 'over_under') {
    if (n.startsWith('over') || n.startsWith('mais') || n === 'o') return 'over';
    if (n.startsWith('under') || n.startsWith('menos') || n === 'u') return 'under';
    return null;
  }
  if (market === 'btts') {
    if (n === 'yes' || n === 'sim') return 'yes';
    if (n === 'no' || n === 'não' || n === 'nao') return 'no';
    return null;
  }
  return null;
}

function selectionLabel(market: MarketType, slug: string, home: string, away: string, line: number | null): string {
  if (market === '1x2') {
    if (slug === 'home') return `${home} (Casa)`;
    if (slug === 'draw') return 'Empate';
    return `${away} (Fora)`;
  }
  if (market === 'over_under') {
    const l = line ?? 2.5;
    return slug === 'over' ? `Mais de ${l}` : `Menos de ${l}`;
  }
  if (market === 'btts') {
    return slug === 'yes' ? 'Ambas marcam: Sim' : 'Ambas marcam: Não';
  }
  return slug;
}

function getName(v: { name?: string } | string | undefined, fallback = ''): string {
  if (!v) return fallback;
  return typeof v === 'string' ? v : v.name ?? fallback;
}

function toEvent(fx: OddsPapiFixture): SportEvent {
  return {
    id: String(fx.id),
    sport: 'football',
    league: getName(fx.league, 'Futebol'),
    home: fx.home ?? getName(fx.homeTeam),
    away: fx.away ?? getName(fx.awayTeam),
    startsAt: fx.startTime ?? fx.commenceTime ?? new Date().toISOString(),
  };
}

/**
 * Converte os odds de UM fixture (resposta `/odds?fixtureId=`) num conjunto de
 * MarketSnapshot — um por tipo de mercado suportado.
 */
export function normalizeFixtureOdds(
  fixture: OddsPapiFixture,
  odds: OddsPapiOddsResponse,
): MarketSnapshot[] {
  const event = toEvent(fixture);
  const books = odds.bookmakerOdds ?? {};

  // Acumulador por tipo de mercado: selections + quotes.
  interface Acc {
    type: MarketType;
    line: number | null;
    selections: Map<string, Selection>; // slug → Selection
    quotes: Partial<Record<BookId, Record<string, OddQuote>>>;
  }
  const byMarket = new Map<string, Acc>(); // chave: `${type}:${line}`
  const now = new Date().toISOString();

  for (const [slug, bookData] of Object.entries(books)) {
    const bookId = mapBookmaker(slug);
    if (!bookId) continue;
    const markets = bookData.markets ?? {};

    for (const [marketId, market] of Object.entries(markets)) {
      const mapped = mapMarket(marketId, market);
      if (!mapped) continue;
      const key = `${mapped.type}:${mapped.line ?? ''}`;
      let acc = byMarket.get(key);
      if (!acc) {
        acc = { type: mapped.type, line: mapped.line, selections: new Map(), quotes: {} };
        byMarket.set(key, acc);
      }

      for (const out of market.outcomes ?? []) {
        const parsed = readOutcome(out);
        if (!parsed) continue;
        const sel = selectionSlug(mapped.type, parsed.sel, event.home, event.away);
        if (!sel) continue;

        const selectionId = `${event.id}:${mapped.type}${mapped.line != null ? `:${mapped.line}` : ''}:${sel}`;
        if (!acc.selections.has(sel)) {
          acc.selections.set(sel, {
            id: selectionId,
            eventId: event.id,
            market: mapped.type,
            line: mapped.line,
            label: selectionLabel(mapped.type, sel, event.home, event.away, mapped.line),
          });
        }
        const q: OddQuote = {
          selectionId,
          book: bookId,
          odd: parsed.odd,
          volume: parsed.volume,
          capturedAt: now,
        };
        (acc.quotes[bookId] ??= {})[selectionId] = q;
      }
    }
  }

  const snapshots: MarketSnapshot[] = [];
  for (const acc of byMarket.values()) {
    const selections = [...acc.selections.values()];
    if (selections.length < 2) continue; // mercado precisa de ≥ 2 seleções
    snapshots.push({
      event,
      market: acc.type,
      line: acc.line,
      selections,
      quotes: acc.quotes as MarketSnapshot['quotes'],
    });
  }
  return snapshots;
}

/**
 * Normaliza um LOTE: pares (fixture, odds). Útil quando se obtêm os fixtures e
 * depois os odds de cada um.
 */
export function normalizeBatch(
  pairs: Array<{ fixture: OddsPapiFixture; odds: OddsPapiOddsResponse }>,
): MarketSnapshot[] {
  return pairs.flatMap((p) => normalizeFixtureOdds(p.fixture, p.odds));
}
