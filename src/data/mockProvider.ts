/**
 * Gerador mock — simula o streaming da OddsPapi sem chave de API.
 * =============================================================
 *
 * Cria eventos de futebol europeu realistas com mercados 1X2, Over/Under 2.5 e
 * BTTS. Para cada mercado define uma probabilidade "verdadeira" latente, deriva
 * odds sharp (Pinnacle/Betfair) com margem pequena, e odds das casas-alvo
 * (Betclic/1xBet) com margem maior MAS com ruído — de vez em quando uma
 * casa-alvo "engana-se" e paga acima do justo, criando uma janela +EV que
 * depois fecha. Isto exercita todo o pipeline e a UI em tempo real.
 *
 * Determinístico o suficiente para ser legível, aleatório o suficiente para
 * parecer vivo.
 */
import type {
  MarketSnapshot,
  SportEvent,
  Selection,
  OddQuote,
  BookId,
  MarketType,
} from '../lib/types';
import type { OddsProvider, SnapshotListener } from './provider';

interface LatentMarket {
  event: SportEvent;
  market: MarketType;
  line: number | null;
  selections: Selection[];
  /** Probabilidades verdadeiras latentes (somam 1). */
  trueProbs: number[];
}

const LEAGUES = [
  { name: 'Liga Portugal', teams: ['Benfica', 'Porto', 'Sporting', 'Braga', 'Vitória SC', 'Gil Vicente'] },
  { name: 'Premier League', teams: ['Arsenal', 'Man City', 'Liverpool', 'Chelsea', 'Spurs', 'Newcastle'] },
  { name: 'LaLiga', teams: ['Real Madrid', 'Barcelona', 'Atlético', 'Real Sociedad', 'Betis', 'Villarreal'] },
  { name: 'Serie A', teams: ['Inter', 'Juventus', 'Milan', 'Napoli', 'Roma', 'Atalanta'] },
];

function rngFactory(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const rng = rngFactory(20260616);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Normaliza um vetor para somar 1. */
function normalize(xs: number[]): number[] {
  const s = xs.reduce((a, b) => a + b, 0);
  return xs.map((x) => x / s);
}

/** Aplica margem a probabilidades justas → odds cotadas (inflaciona a soma). */
function pricesWithMargin(trueProbs: number[], margin: number, noise: number): number[] {
  return trueProbs.map((p) => {
    // adiciona margem proporcional + ruído idiossincrático por seleção
    const inflated = p * (1 + margin) * (1 + (rng() - 0.5) * 2 * noise);
    return 1 / Math.max(0.0001, inflated);
  });
}

function buildLatentMarkets(): LatentMarket[] {
  const markets: LatentMarket[] = [];
  const used = new Set<string>();
  const now = Date.now();

  for (let i = 0; i < 8; i++) {
    const league = pick(LEAGUES);
    let home = pick(league.teams);
    let away = pick(league.teams);
    let guard = 0;
    while ((away === home || used.has(`${league.name}:${home}:${away}`)) && guard++ < 20) {
      home = pick(league.teams);
      away = pick(league.teams);
    }
    used.add(`${league.name}:${home}:${away}`);

    const event: SportEvent = {
      id: `evt_${i}`,
      sport: 'football',
      league: league.name,
      home,
      away,
      startsAt: new Date(now + (1 + Math.floor(rng() * 72)) * 3600_000).toISOString(),
    };

    // 1X2 — força latente da casa
    const homeStrength = 0.35 + rng() * 0.35;
    const awayStrength = 0.25 + rng() * 0.3;
    const drawStrength = 0.22 + rng() * 0.08;
    const p1x2 = normalize([homeStrength, drawStrength, awayStrength]);
    markets.push({
      event,
      market: '1x2',
      line: null,
      selections: [
        { id: `${event.id}:1x2:home`, eventId: event.id, market: '1x2', line: null, label: `${home} (Casa)` },
        { id: `${event.id}:1x2:draw`, eventId: event.id, market: '1x2', line: null, label: 'Empate' },
        { id: `${event.id}:1x2:away`, eventId: event.id, market: '1x2', line: null, label: `${away} (Fora)` },
      ],
      trueProbs: p1x2,
    });

    // Over/Under 2.5
    const pOver = 0.42 + rng() * 0.2;
    const ou = normalize([pOver, 1 - pOver]);
    markets.push({
      event,
      market: 'over_under',
      line: 2.5,
      selections: [
        { id: `${event.id}:ou25:over`, eventId: event.id, market: 'over_under', line: 2.5, label: 'Mais de 2.5' },
        { id: `${event.id}:ou25:under`, eventId: event.id, market: 'over_under', line: 2.5, label: 'Menos de 2.5' },
      ],
      trueProbs: ou,
    });

    // BTTS
    const pYes = 0.45 + rng() * 0.2;
    const btts = normalize([pYes, 1 - pYes]);
    markets.push({
      event,
      market: 'btts',
      line: null,
      selections: [
        { id: `${event.id}:btts:yes`, eventId: event.id, market: 'btts', line: null, label: 'Ambas marcam: Sim' },
        { id: `${event.id}:btts:no`, eventId: event.id, market: 'btts', line: null, label: 'Ambas marcam: Não' },
      ],
      trueProbs: btts,
    });
  }
  return markets;
}

const SHARP_BOOKS: BookId[] = ['pinnacle', 'betfair'];
const TARGET_BOOKS: BookId[] = ['betclic', '1xbet'];

function snapshotFor(m: LatentMarket): MarketSnapshot {
  const now = new Date().toISOString();
  const quotes: MarketSnapshot['quotes'] = {} as MarketSnapshot['quotes'];

  // Sharp: margem pequena (2-3%), pouco ruído → boa estimativa do justo.
  for (const book of SHARP_BOOKS) {
    const margin = book === 'pinnacle' ? 0.025 : 0.015; // Betfair exchange ~justa
    const odds = pricesWithMargin(m.trueProbs, margin, 0.004);
    const rec: Record<string, OddQuote> = {};
    m.selections.forEach((sel, i) => {
      rec[sel.id] = {
        selectionId: sel.id,
        book,
        odd: round2(odds[i]),
        volume: book === 'betfair' ? Math.round(500 + rng() * 5000) : undefined,
        capturedAt: now,
      };
    });
    quotes[book] = rec;
  }

  // Casas-alvo: margem maior (6-8%) mas com ruído maior → por vezes >justo (+EV).
  for (const book of TARGET_BOOKS) {
    const margin = book === 'betclic' ? 0.06 : 0.075;
    const odds = pricesWithMargin(m.trueProbs, margin, 0.05);
    const rec: Record<string, OddQuote> = {};
    m.selections.forEach((sel, i) => {
      rec[sel.id] = { selectionId: sel.id, book, odd: round2(odds[i]), capturedAt: now };
    });
    quotes[book] = rec;
  }

  return { event: m.event, market: m.market, line: m.line, selections: m.selections, quotes };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Provider mock. A cada `intervalMs`, faz "drift" leve às probabilidades
 * latentes (mercado a mexer) e re-emite todos os snapshots. Pré-jogo:
 * 3-10s é realista; usamos 4s por defeito.
 */
export class MockOddsProvider implements OddsProvider {
  readonly name = 'OddsPapi (mock)';
  private markets: LatentMarket[];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private intervalMs = 4000) {
    this.markets = buildLatentMarkets();
  }

  subscribe(listener: SnapshotListener): () => void {
    // Emite já um primeiro snapshot.
    listener(this.markets.map(snapshotFor));

    this.timer = setInterval(() => {
      // drift latente pequeno (±1.5% relativo) → re-normaliza.
      for (const m of this.markets) {
        m.trueProbs = normalize(
          m.trueProbs.map((p) => Math.max(0.02, p * (1 + (rng() - 0.5) * 0.03))),
        );
      }
      listener(this.markets.map(snapshotFor));
    }, this.intervalMs);

    return () => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    };
  }
}
