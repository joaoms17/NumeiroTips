/**
 * Normalização The Odds API (v4) → MarketSnapshot[]
 * =================================================
 *
 * O The Odds API (the-odds-api.com) tem tier grátis e cobre as 4 casas que nos
 * interessam — Pinnacle, Betfair Exchange (`betfair_ex_eu`), Betclic e 1xBet
 * (`onexbet`) — para futebol europeu, com odds pré-jogo e in-play.
 *
 * Schema (PÚBLICO e estável, ao contrário da OddsPapi) — `/v4/sports/{sport}/odds`:
 *
 *   [
 *     {
 *       "id": "...", "sport_key": "soccer_epl",
 *       "commence_time": "2026-06-20T19:00:00Z",
 *       "home_team": "Arsenal", "away_team": "Chelsea",
 *       "bookmakers": [
 *         { "key": "pinnacle", "title": "Pinnacle",
 *           "markets": [
 *             { "key": "h2h",    "outcomes": [ {"name":"Arsenal","price":2.1}, {"name":"Chelsea","price":3.5}, {"name":"Draw","price":3.4} ] },
 *             { "key": "totals", "outcomes": [ {"name":"Over","price":1.95,"point":2.5}, {"name":"Under","price":1.9,"point":2.5} ] }
 *           ] }
 *       ]
 *     }
 *   ]
 *
 * Notas:
 *  - `h2h` em futebol traz 3 resultados (casa, empate, fora) → o nosso 1x2.
 *    A seleção é mapeada pelos nomes das equipas do próprio evento + "Draw".
 *  - `totals` → over_under, com a linha em `outcome.point`.
 *  - `btts` (se pedido) → ambas marcam (Yes/No). É um "additional market" e pode
 *    exigir plano pago; por isso fica fora dos `markets` por defeito.
 *  - preços vêm já em decimal quando se pede `oddsFormat=decimal`.
 */
import type {
  MarketSnapshot,
  SportEvent,
  Selection,
  OddQuote,
  BookId,
  MarketType,
} from '../lib/types';

export interface TOAOutcome {
  name: string;
  price: number;
  point?: number;
}
export interface TOAMarket {
  key: string;
  outcomes: TOAOutcome[];
  last_update?: string;
}
export interface TOABookmaker {
  key: string;
  title?: string;
  last_update?: string;
  markets: TOAMarket[];
}
export interface TOAEvent {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: TOABookmaker[];
}

/** Chaves de bookmaker do The Odds API → nosso BookId. */
const BOOKMAKER_KEYS: Record<string, BookId> = {
  pinnacle: 'pinnacle',
  betfair_ex_eu: 'betfair',
  betfair_ex_uk: 'betfair',
  betfair: 'betfair',
  betclic: 'betclic',
  onexbet: '1xbet',
};

function mapBookmaker(key: string): BookId | null {
  return BOOKMAKER_KEYS[key.toLowerCase()] ?? null;
}

function mapMarket(key: string): MarketType | null {
  switch (key) {
    case 'h2h':
    case 'h2h_3_way':
      return '1x2';
    case 'totals':
      return 'over_under';
    case 'spreads':
      return 'ah'; // handicap
    case 'btts':
      return 'btts';
    default:
      return null;
  }
}

/** Linha (handicap) do mercado de spreads, relativa à equipa da casa. */
function handicapHomeLine(mk: TOAMarket, home: string, away: string): number | null {
  for (const o of mk.outcomes ?? []) {
    if (o.point == null) continue;
    if (o.name === home) return o.point;
    if (o.name === away) return -o.point;
  }
  return null;
}

function signedLine(l: number): string {
  return l > 0 ? `+${l}` : `${l}`;
}

/** Mapeia um outcome para o nosso slug de seleção, por mercado. */
function selectionSlug(
  market: MarketType,
  outcome: TOAOutcome,
  home: string,
  away: string,
): string | null {
  const n = outcome.name.trim();
  if (market === '1x2') {
    if (n === home) return 'home';
    if (n === away) return 'away';
    if (n.toLowerCase() === 'draw' || n.toLowerCase() === 'empate') return 'draw';
    return null;
  }
  if (market === 'over_under') {
    const low = n.toLowerCase();
    if (low.startsWith('over')) return 'over';
    if (low.startsWith('under')) return 'under';
    return null;
  }
  if (market === 'btts') {
    const low = n.toLowerCase();
    if (low === 'yes') return 'yes';
    if (low === 'no') return 'no';
    return null;
  }
  if (market === 'ah') {
    if (n === home) return 'home';
    if (n === away) return 'away';
    return null;
  }
  return null;
}

function selectionLabel(
  market: MarketType,
  slug: string,
  home: string,
  away: string,
  line: number | null,
): string {
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
  if (market === 'ah') {
    const l = line ?? 0;
    return slug === 'home' ? `${home} (${signedLine(l)})` : `${away} (${signedLine(-l)})`;
  }
  return slug;
}

function toEvent(ev: TOAEvent): SportEvent {
  return {
    id: ev.id,
    sport: 'football',
    league: ev.sport_title ?? ev.sport_key,
    home: ev.home_team,
    away: ev.away_team,
    startsAt: ev.commence_time,
  };
}

/** Converte UM evento The Odds API num conjunto de MarketSnapshot (1 por mercado). */
export function normalizeTheOddsApiEvent(ev: TOAEvent): MarketSnapshot[] {
  const event = toEvent(ev);
  const now = new Date().toISOString();

  interface Acc {
    type: MarketType;
    line: number | null;
    selections: Map<string, Selection>;
    quotes: Partial<Record<BookId, Record<string, OddQuote>>>;
  }
  const byMarket = new Map<string, Acc>(); // `${type}:${line}`

  for (const bm of ev.bookmakers ?? []) {
    const bookId = mapBookmaker(bm.key);
    if (!bookId) continue;

    for (const mk of bm.markets ?? []) {
      const type = mapMarket(mk.key);
      if (!type) continue;
      // linha: over/under vem em `point`; handicap é relativo à casa.
      let line: number | null = null;
      if (type === 'over_under') line = mk.outcomes[0]?.point ?? 2.5;
      else if (type === 'ah') {
        line = handicapHomeLine(mk, event.home, event.away);
        if (line == null) continue; // sem linha não dá para agrupar
      }
      const key = `${type}:${line ?? ''}`;
      let acc = byMarket.get(key);
      if (!acc) {
        acc = { type, line, selections: new Map(), quotes: {} };
        byMarket.set(key, acc);
      }

      for (const out of mk.outcomes ?? []) {
        if (!(out.price > 1)) continue;
        const slug = selectionSlug(type, out, event.home, event.away);
        if (!slug) continue;
        const selId = `${event.id}:${type}${line != null ? `:${line}` : ''}:${slug}`;
        if (!acc.selections.has(slug)) {
          acc.selections.set(slug, {
            id: selId,
            eventId: event.id,
            market: type,
            line,
            label: selectionLabel(type, slug, event.home, event.away, line),
          });
        }
        (acc.quotes[bookId] ??= {})[selId] = {
          selectionId: selId,
          book: bookId,
          odd: out.price,
          capturedAt: now,
        };
      }
    }
  }

  const snapshots: MarketSnapshot[] = [];
  for (const acc of byMarket.values()) {
    const selections = [...acc.selections.values()];
    if (selections.length < 2) continue;
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

export function normalizeTheOddsApi(events: TOAEvent[]): MarketSnapshot[] {
  return (events ?? []).flatMap(normalizeTheOddsApiEvent);
}
