/**
 * Normalização The Odds API (v4) → snapshots (versão Deno para Edge Functions).
 * Espelha src/data/theOddsApiNormalize.ts — manter as duas em sincronia.
 * Schema público: /v4/sports/{sport}/odds → eventos com bookmakers/markets/outcomes.
 */
import type { Snapshot, BookId, MarketType } from "./oddspapi.ts";

interface TOAOutcome { name: string; price: number; point?: number; }
interface TOAMarket { key: string; outcomes: TOAOutcome[]; }
interface TOABookmaker { key: string; markets: TOAMarket[]; }
interface TOAEvent {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: TOABookmaker[];
}

const BOOKMAKER_KEYS: Record<string, BookId> = {
  pinnacle: "pinnacle",
  betfair_ex_eu: "betfair",
  betfair_ex_uk: "betfair",
  betfair: "betfair",
  betclic: "betclic",
  onexbet: "1xbet",
};

function mapBookmaker(key: string): BookId | null {
  return BOOKMAKER_KEYS[key.toLowerCase()] ?? null;
}

function mapMarket(key: string): MarketType | null {
  if (key === "h2h" || key === "h2h_3_way") return "1x2";
  if (key === "totals") return "over_under";
  if (key === "btts") return "btts";
  return null;
}

function slugFor(market: MarketType, out: TOAOutcome, home: string, away: string): string | null {
  const n = out.name.trim();
  if (market === "1x2") {
    if (n === home) return "home";
    if (n === away) return "away";
    if (n.toLowerCase() === "draw") return "draw";
    return null;
  }
  if (market === "over_under") {
    const l = n.toLowerCase();
    if (l.startsWith("over")) return "over";
    if (l.startsWith("under")) return "under";
    return null;
  }
  if (market === "btts") {
    const l = n.toLowerCase();
    if (l === "yes") return "yes";
    if (l === "no") return "no";
    return null;
  }
  return null;
}

function label(market: MarketType, slug: string, home: string, away: string, line: number | null): string {
  if (market === "1x2") return slug === "home" ? `${home} (Casa)` : slug === "draw" ? "Empate" : `${away} (Fora)`;
  if (market === "over_under") return slug === "over" ? `Mais de ${line ?? 2.5}` : `Menos de ${line ?? 2.5}`;
  return slug === "yes" ? "Ambas marcam: Sim" : "Ambas marcam: Não";
}

export function normalizeTheOddsApiEvent(ev: TOAEvent): Snapshot[] {
  const home = ev.home_team;
  const away = ev.away_team;
  const byMarket = new Map<string, Snapshot>();

  for (const bm of ev.bookmakers ?? []) {
    const bookId = mapBookmaker(bm.key);
    if (!bookId) continue;
    for (const mk of bm.markets ?? []) {
      const type = mapMarket(mk.key);
      if (!type) continue;
      const line = type === "over_under" ? (mk.outcomes[0]?.point ?? 2.5) : null;
      const key = `${type}:${line ?? ""}`;
      let snap = byMarket.get(key);
      if (!snap) {
        snap = {
          eventId: ev.id, league: ev.sport_title ?? ev.sport_key,
          home, away, startsAt: ev.commence_time,
          market: type, line, selections: [], odds: {}, volumes: {},
        };
        byMarket.set(key, snap);
      }
      for (const out of mk.outcomes ?? []) {
        if (!(out.price > 1)) continue;
        const slug = slugFor(type, out, home, away);
        if (!slug) continue;
        const selId = `${ev.id}:${type}${line != null ? `:${line}` : ""}:${slug}`;
        if (!snap.selections.find((s) => s.id === selId)) {
          snap.selections.push({ id: selId, label: label(type, slug, home, away, line), market: type, line });
        }
        (snap.odds[bookId] ??= {})[selId] = out.price;
      }
    }
  }
  return [...byMarket.values()].filter((s) => s.selections.length >= 2);
}

export function normalizeTheOddsApi(events: TOAEvent[]): Snapshot[] {
  return (events ?? []).flatMap(normalizeTheOddsApiEvent);
}
