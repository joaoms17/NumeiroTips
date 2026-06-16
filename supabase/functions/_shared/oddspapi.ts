/**
 * Normalização OddsPapi → snapshots (versão Deno para Edge Functions).
 * Espelha src/data/oddsPapiNormalize.ts — manter as duas em sincronia.
 * A documentação completa e os TODO de campos a confirmar estão lá.
 */

export type BookId = "pinnacle" | "betfair" | "betclic" | "1xbet";
export type MarketType = "1x2" | "over_under" | "btts" | "ah";

export interface SnapSelection {
  id: string;
  label: string;
  market: MarketType;
  line: number | null;
}
export interface Snapshot {
  eventId: string;
  league: string;
  home: string;
  away: string;
  startsAt: string;
  market: MarketType;
  line: number | null;
  selections: SnapSelection[];
  // odds[book][selectionId] = odd
  odds: Record<string, Record<string, number>>;
  volumes: Record<string, Record<string, number>>;
}

const BOOKMAKER_SLUGS: Record<string, BookId> = {
  pinnacle: "pinnacle",
  pinnaclesports: "pinnacle",
  betfair: "betfair",
  betfair_ex: "betfair",
  betfairexchange: "betfair",
  betclic: "betclic",
  "1xbet": "1xbet",
  onexbet: "1xbet",
};

function mapBookmaker(slug: string): BookId | null {
  const key = slug.toLowerCase().replace(/[\s_-]/g, "");
  return BOOKMAKER_SLUGS[slug.toLowerCase()] ?? BOOKMAKER_SLUGS[key] ?? null;
}

function mapMarket(
  marketId: string,
  market: any,
): { type: MarketType; line: number | null } | null {
  const id = `${market?.type ?? market?.name ?? marketId}`.toLowerCase();
  const line = market?.line ?? market?.outcomes?.[0]?.line ?? null;
  if (/(^|[^a-z])(1x2|moneyline_?3way|match_?odds|fulltimeresult)/.test(id)) {
    return { type: "1x2", line: null };
  }
  if (/(over_?under|totals|total_?goals|goals_?ou)/.test(id)) {
    return { type: "over_under", line: line ?? 2.5 };
  }
  if (/(btts|both_?teams_?to_?score|goal_?goal)/.test(id)) {
    return { type: "btts", line: null };
  }
  return null;
}

function readOutcome(o: any): { sel: string; odd: number; volume?: number } | null {
  const odd = o?.price ?? o?.odds ?? o?.value ?? o?.decimal;
  const sel = (o?.name ?? o?.label ?? o?.selection ?? o?.type ?? "").toString();
  const volume = o?.volume ?? o?.liquidity;
  if (!sel || !(typeof odd === "number" && odd > 1)) return null;
  return { sel, odd, volume };
}

function selectionSlug(market: MarketType, raw: string, home: string, away: string): string | null {
  const n = raw.trim().toLowerCase();
  if (market === "1x2") {
    if (n === "1" || n === "home" || n === home.toLowerCase()) return "home";
    if (n === "x" || n === "draw" || n === "empate") return "draw";
    if (n === "2" || n === "away" || n === away.toLowerCase()) return "away";
    return null;
  }
  if (market === "over_under") {
    if (n.startsWith("over") || n.startsWith("mais") || n === "o") return "over";
    if (n.startsWith("under") || n.startsWith("menos") || n === "u") return "under";
    return null;
  }
  if (market === "btts") {
    if (n === "yes" || n === "sim") return "yes";
    if (n === "no" || n === "nao" || n === "não") return "no";
    return null;
  }
  return null;
}

function label(market: MarketType, slug: string, home: string, away: string, line: number | null): string {
  if (market === "1x2") return slug === "home" ? `${home} (Casa)` : slug === "draw" ? "Empate" : `${away} (Fora)`;
  if (market === "over_under") return slug === "over" ? `Mais de ${line ?? 2.5}` : `Menos de ${line ?? 2.5}`;
  return slug === "yes" ? "Ambas marcam: Sim" : "Ambas marcam: Não";
}

function name(v: any, fallback = ""): string {
  if (!v) return fallback;
  return typeof v === "string" ? v : (v.name ?? fallback);
}

export function normalizeFixtureOdds(fixture: any, odds: any): Snapshot[] {
  const eventId = String(fixture.id);
  const home = fixture.home ?? name(fixture.homeTeam);
  const away = fixture.away ?? name(fixture.awayTeam);
  const league = name(fixture.league, "Futebol");
  const startsAt = fixture.startTime ?? fixture.commenceTime ?? new Date().toISOString();
  const books = odds?.bookmakerOdds ?? {};

  const byMarket = new Map<string, Snapshot>();
  for (const [slug, bookData] of Object.entries<any>(books)) {
    const bookId = mapBookmaker(slug);
    if (!bookId) continue;
    for (const [marketId, market] of Object.entries<any>(bookData?.markets ?? {})) {
      const mapped = mapMarket(marketId, market);
      if (!mapped) continue;
      const key = `${mapped.type}:${mapped.line ?? ""}`;
      let snap = byMarket.get(key);
      if (!snap) {
        snap = {
          eventId, league, home, away, startsAt,
          market: mapped.type, line: mapped.line,
          selections: [], odds: {}, volumes: {},
        };
        byMarket.set(key, snap);
      }
      for (const out of market?.outcomes ?? []) {
        const parsed = readOutcome(out);
        if (!parsed) continue;
        const sel = selectionSlug(mapped.type, parsed.sel, home, away);
        if (!sel) continue;
        const selId = `${eventId}:${mapped.type}${mapped.line != null ? `:${mapped.line}` : ""}:${sel}`;
        if (!snap.selections.find((s) => s.id === selId)) {
          snap.selections.push({ id: selId, label: label(mapped.type, sel, home, away, mapped.line), market: mapped.type, line: mapped.line });
        }
        (snap.odds[bookId] ??= {})[selId] = parsed.odd;
        if (parsed.volume != null) (snap.volumes[bookId] ??= {})[selId] = parsed.volume;
      }
    }
  }
  return [...byMarket.values()].filter((s) => s.selections.length >= 2);
}
