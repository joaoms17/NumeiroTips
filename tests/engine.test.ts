import { describe, it, expect } from 'vitest';
import { evaluateMarket, evaluateFeed, computeFairPrices } from '../src/engine/engine';
import { DEFAULT_ENGINE_CONFIG } from '../src/lib/types';
import type { MarketSnapshot, EngineConfig } from '../src/lib/types';

/** Constrói um snapshot 1X2 com odds controladas por casa. */
function makeSnapshot(odds: {
  pinnacle: [number, number, number];
  betclic: [number, number, number];
  '1xbet': [number, number, number];
}): MarketSnapshot {
  const event = {
    id: 'evt1',
    sport: 'football' as const,
    league: 'Teste',
    home: 'A',
    away: 'B',
    startsAt: new Date(Date.now() + 3600_000).toISOString(),
  };
  const selections = [
    { id: 'evt1:1x2:home', eventId: 'evt1', market: '1x2' as const, line: null, label: 'A' },
    { id: 'evt1:1x2:draw', eventId: 'evt1', market: '1x2' as const, line: null, label: 'X' },
    { id: 'evt1:1x2:away', eventId: 'evt1', market: '1x2' as const, line: null, label: 'B' },
  ];
  const now = new Date().toISOString();
  const mk = (book: string, os: number[]) =>
    Object.fromEntries(
      selections.map((s, i) => [s.id, { selectionId: s.id, book, odd: os[i], capturedAt: now }]),
    );
  return {
    event,
    market: '1x2',
    line: null,
    selections,
    quotes: {
      pinnacle: mk('pinnacle', odds.pinnacle),
      betclic: mk('betclic', odds.betclic),
      '1xbet': mk('1xbet', odds['1xbet']),
    } as MarketSnapshot['quotes'],
  };
}

const config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG, bankroll: 1000 };

describe('motor — preços justos', () => {
  it('de-vig da régua sharp soma 1', () => {
    const snap = makeSnapshot({
      pinnacle: [2.0, 3.5, 4.0],
      betclic: [2.0, 3.5, 4.0],
      '1xbet': [2.0, 3.5, 4.0],
    });
    const fairs = computeFairPrices(snap, 'pinnacle', 'shin');
    expect(fairs).not.toBeNull();
    const sum = fairs!.reduce((a, f) => a + f.prob, 0);
    expect(sum).toBeCloseTo(1, 8);
  });

  it('sharp incompleta → sem preços justos', () => {
    const snap = makeSnapshot({
      pinnacle: [2.0, 3.5, 4.0],
      betclic: [2.0, 3.5, 4.0],
      '1xbet': [2.0, 3.5, 4.0],
    });
    // estraga uma odd sharp
    snap.quotes.pinnacle['evt1:1x2:draw'].odd = 1;
    expect(computeFairPrices(snap, 'pinnacle', 'shin')).toBeNull();
  });
});

describe('motor — deteção de value bets', () => {
  it('sinaliza quando uma casa-alvo paga acima do justo', () => {
    // Sharp justo (sem margem): 2.0/4.0/4.0 → de-vig dá probs.
    // Betclic paga 2.20 na casa (acima do justo) → +EV; resto abaixo.
    const snap = makeSnapshot({
      pinnacle: [2.0, 4.0, 4.0],
      betclic: [2.2, 3.6, 3.6],
      '1xbet': [2.05, 3.7, 3.7],
    });
    const bets = evaluateMarket(snap, config);
    const homeBet = bets.find((b) => b.selection.id === 'evt1:1x2:home');
    expect(homeBet).toBeDefined();
    expect(homeBet!.bestEdge).toBeGreaterThan(config.edgeThreshold);
    // line shopping escolhe a odd mais alta entre as +EV (Betclic 2.20 > 1xBet 2.05)
    expect(homeBet!.bestBook).toBe('betclic');
    expect(homeBet!.bestOdd).toBe(2.2);
    // stake Kelly positivo
    expect(homeBet!.stake).not.toBeNull();
    expect(homeBet!.stake!).toBeGreaterThan(0);
  });

  it('não sinaliza nada quando ambas as casas têm margem normal', () => {
    // casas-alvo sempre abaixo do justo → feed vazio
    const snap = makeSnapshot({
      pinnacle: [2.0, 4.0, 4.0],
      betclic: [1.9, 3.7, 3.7],
      '1xbet': [1.88, 3.65, 3.65],
    });
    const bets = evaluateMarket(snap, config);
    expect(bets.length).toBe(0);
  });

  it('preserva detectedAt entre ciclos (atualização incremental)', () => {
    const snap = makeSnapshot({
      pinnacle: [2.0, 4.0, 4.0],
      betclic: [2.2, 3.6, 3.6],
      '1xbet': [2.05, 3.7, 3.7],
    });
    const first = evaluateMarket(snap, config);
    const index = new Map(first.map((b) => [b.id, b]));
    const originalDetectedAt = first[0].detectedAt;

    // segundo ciclo um pouco depois
    const second = evaluateMarket(snap, config, index);
    const same = second.find((b) => b.id === first[0].id)!;
    expect(same.detectedAt).toBe(originalDetectedAt); // frescura preservada
  });

  it('feed ordenado por edge decrescente', () => {
    const snap = makeSnapshot({
      pinnacle: [2.0, 4.0, 4.0],
      betclic: [2.3, 4.4, 4.1], // vários +EV de magnitudes diferentes
      '1xbet': [2.1, 4.2, 4.0],
    });
    const feed = evaluateFeed([snap], config);
    for (let i = 1; i < feed.length; i++) {
      expect(feed[i - 1].bestEdge).toBeGreaterThanOrEqual(feed[i].bestEdge);
    }
  });
});
