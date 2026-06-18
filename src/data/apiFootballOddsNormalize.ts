/**
 * Normalização API-Football (/odds) → MarketSnapshot[]
 * ====================================================
 *
 * A API-Football (api-sports.io) tem quota DIÁRIA (100/dia, reseta 00:00 UTC) —
 * ao contrário do The Odds API (500/MÊS). Por isso é a fonte ideal para não
 * ficar "um mês morto": a quota volta todos os dias.
 *
 * Resposta de `/odds?fixture={id}` (simplificada):
 *   response: [{
 *     fixture: { id, ... },
 *     bookmakers: [
 *       { id, name: "Pinnacle", bets: [
 *           { id, name: "Match Winner", values: [ {value:"Home",odd:"2.10"}, {value:"Draw",odd:"3.40"}, {value:"Away",odd:"3.50"} ] },
 *           { id, name: "Goals Over/Under", values: [ {value:"Over 2.5",odd:"1.95"}, {value:"Under 2.5",odd:"1.90"} ] },
 *           { id, name: "Both Teams Score", values: [ {value:"Yes",odd:"1.80"}, {value:"No",odd:"2.00"} ] }
 *       ] }
 *     ]
 *   }]
 *
 * O endpoint de odds NÃO traz os nomes das equipas — por isso recebemos `meta`
 * (id, casa, fora, liga, início) do endpoint /fixtures e juntamos aqui.
 *
 * Mapeamos as casas por NOME (robusto a mudanças de id): Pinnacle (sharp),
 * Betfair (sharp), Betclic e 1xBet (alvo). Mercados suportados: 1X2, over/under
 * e ambas marcam (os que interessam e vêm de forma estável).
 */
import type {
  MarketSnapshot,
  SportEvent,
  Selection,
  OddQuote,
  BookId,
  MarketType,
} from '../lib/types';

export interface AFOddValue {
  value: string;
  odd: string;
}
export interface AFBet {
  id?: number;
  name: string;
  values: AFOddValue[];
}
export interface AFBookmaker {
  id?: number;
  name: string;
  bets: AFBet[];
}
export interface AFOddsEntry {
  bookmakers: AFBookmaker[];
}

/** Meta do jogo (vinda de /fixtures) para juntar às odds. */
export interface AFFixtureMeta {
  id: string;
  home: string;
  away: string;
  league: string;
  startsAt: string;
}

/** Nome da casa (API-Football) → nosso BookId (por substring, case-insensitive). */
function mapBookName(name: string): BookId | null {
  const n = name.toLowerCase();
  if (n.includes('pinnacle')) return 'pinnacle';
  if (n.includes('betfair')) return 'betfair';
  if (n.includes('betclic')) return 'betclic';
  if (n.includes('1xbet') || n.includes('1x bet')) return '1xbet';
  return null;
}

/** Nome do mercado (API-Football "bet name") → nosso MarketType. */
function mapBetName(name: string): MarketType | null {
  const n = name.toLowerCase();
  if (n === 'match winner' || n === 'home/away' || n === '1x2') return '1x2';
  if (n.includes('over/under') || n === 'goals over/under' || n === 'over/under') return 'over_under';
  if (n.includes('both teams') && n.includes('score')) return 'btts';
  return null;
}

/** Extrai slug + linha de um value, por mercado. null = ignorar. */
function parseValue(
  market: MarketType,
  value: string,
): { slug: string; line: number | null } | null {
  const v = value.trim();
  const low = v.toLowerCase();
  if (market === '1x2') {
    if (low === 'home' || low === '1') return { slug: 'home', line: null };
    if (low === 'draw' || low === 'x') return { slug: 'draw', line: null };
    if (low === 'away' || low === '2') return { slug: 'away', line: null };
    return null;
  }
  if (market === 'over_under') {
    const m = low.match(/^(over|under)\s+([0-9]+(?:\.[0-9]+)?)$/);
    if (!m) return null;
    return { slug: m[1], line: Number(m[2]) };
  }
  if (market === 'btts') {
    if (low === 'yes') return { slug: 'yes', line: null };
    if (low === 'no') return { slug: 'no', line: null };
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
  return slug;
}

/** Converte as odds de UM jogo (API-Football) num conjunto de MarketSnapshot. */
export function normalizeApiFootballOdds(
  meta: AFFixtureMeta,
  entry: AFOddsEntry,
): MarketSnapshot[] {
  const event: SportEvent = {
    id: meta.id,
    sport: 'football',
    league: meta.league,
    home: meta.home,
    away: meta.away,
    startsAt: meta.startsAt,
  };
  const now = new Date().toISOString();

  interface Acc {
    type: MarketType;
    line: number | null;
    selections: Map<string, Selection>;
    quotes: Partial<Record<BookId, Record<string, OddQuote>>>;
  }
  const byMarket = new Map<string, Acc>();

  for (const bm of entry.bookmakers ?? []) {
    const bookId = mapBookName(bm.name ?? '');
    if (!bookId) continue;

    for (const bet of bm.bets ?? []) {
      const type = mapBetName(bet.name ?? '');
      if (!type) continue;

      for (const val of bet.values ?? []) {
        const odd = Number(val.odd);
        if (!(odd > 1)) continue;
        const parsed = parseValue(type, val.value);
        if (!parsed) continue;
        const { slug, line } = parsed;

        const key = `${type}:${line ?? ''}`;
        let acc = byMarket.get(key);
        if (!acc) {
          acc = { type, line, selections: new Map(), quotes: {} };
          byMarket.set(key, acc);
        }
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
          odd,
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
