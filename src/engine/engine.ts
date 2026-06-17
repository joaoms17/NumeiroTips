/**
 * O MOTOR (+EV engine)
 * ====================
 *
 * Pega num MarketSnapshot (preços sharp + casas-alvo para um mercado) e produz
 * value bets. Pipeline, exatamente como na lógica central:
 *
 *   1. Lê o preço sharp (Pinnacle/Betfair) de TODAS as seleções do mercado.
 *   2. De-vig (Shin, fallback proporcional) → prob. e odd justas por seleção.
 *   3. Lê a MESMA seleção só na Betclic e na 1xBet.
 *   4. edge = odd_casa · prob_justa − 1, por casa.
 *   5. Sinaliza onde edge ≥ limiar; recomenda a odd mais alta entre as +EV.
 *   6. (ordenação por edge é feita a jusante, no store/feed.)
 *
 * É puro e sem dependências de I/O → reutilizável no browser e numa Edge
 * Function (Deno). Os testes do motor matemático cobrem as fórmulas; aqui a
 * orquestração junta tudo.
 */

import { devig } from '../lib/math/devig';
import { expectedValue, lineShop } from '../lib/math/ev';
import { kelly } from '../lib/math/kelly';
import type {
  MarketSnapshot,
  ValueBet,
  EngineConfig,
  FairPrice,
  BookEdge,
  TargetBook,
  SharpBook,
  BookId,
} from '../lib/types';
import { deepLinkFor } from '../lib/deeplinks';

/** De-vig de UMA régua sharp → probabilidades por seleção (ou null). */
function devigSharp(
  snap: MarketSnapshot,
  source: SharpBook,
  method: 'shin' | 'proportional',
): number[] | null {
  const sharpQuotes = snap.quotes[source as BookId];
  if (!sharpQuotes) return null;
  const odds: number[] = [];
  for (const sel of snap.selections) {
    const q = sharpQuotes[sel.id];
    if (!q || !(q.odd > 1)) return null;
    odds.push(q.odd);
  }
  return devig(odds, method).outcomes.map((o) => o.prob);
}

/** Calcula os preços justos de um mercado a partir de UMA régua sharp. */
export function computeFairPrices(
  snap: MarketSnapshot,
  source: SharpBook,
  method: 'shin' | 'proportional',
): FairPrice[] | null {
  const probs = devigSharp(snap, source, method);
  if (!probs) return null;
  const now = new Date().toISOString();
  return snap.selections.map((sel, i) => ({
    selectionId: sel.id,
    prob: probs[i],
    fairOdd: 1 / probs[i],
    method,
    source,
    sharps: 1,
    divergence: 0,
    computedAt: now,
  }));
}

/**
 * Preço justo por CONSENSO de réguas sharp (Pinnacle + Betfair).
 * Usa as duas quando ambas cotam o mercado: a probabilidade justa é a média e
 * mede-se a DIVERGÊNCIA entre elas (sinal de fiabilidade). Com só uma, usa essa.
 * `preferred` é a régua a usar quando só uma está disponível / para o rótulo.
 */
export function computeConsensusFair(
  snap: MarketSnapshot,
  preferred: SharpBook,
  method: 'shin' | 'proportional',
): FairPrice[] | null {
  const pin = devigSharp(snap, 'pinnacle', method);
  const bet = devigSharp(snap, 'betfair', method);
  const available: Array<{ src: SharpBook; probs: number[] }> = [];
  if (pin) available.push({ src: 'pinnacle', probs: pin });
  if (bet) available.push({ src: 'betfair', probs: bet });
  if (available.length === 0) return null;

  const n = snap.selections.length;
  const now = new Date().toISOString();

  if (available.length === 1) {
    const only = available[0];
    return snap.selections.map((sel, i) => ({
      selectionId: sel.id,
      prob: only.probs[i],
      fairOdd: 1 / only.probs[i],
      method,
      source: only.src,
      sharps: 1,
      divergence: 0,
      computedAt: now,
    }));
  }

  // duas sharps: média + divergência (pp média entre elas), renormalizada.
  const [a, b] = available;
  let divSum = 0;
  const avg: number[] = [];
  for (let i = 0; i < n; i++) {
    avg.push((a.probs[i] + b.probs[i]) / 2);
    divSum += Math.abs(a.probs[i] - b.probs[i]);
  }
  const s = avg.reduce((x, y) => x + y, 0) || 1;
  const divergence = divSum / n;
  return snap.selections.map((sel, i) => {
    const prob = avg[i] / s;
    return {
      selectionId: sel.id,
      prob,
      fairOdd: 1 / prob,
      method,
      source: preferred,
      sharps: 2,
      divergence,
      computedAt: now,
    };
  });
}

/** Limiar de edge implausível (provável erro de odd). */
const SUSPICIOUS_EDGE = 0.15;
/** Divergência de sharps acima da qual o consenso é "frágil" (pp). */
const HIGH_DIVERGENCE = 0.03;

/** Classifica a fiabilidade de um sinal. */
export function rateReliability(
  fair: FairPrice,
  bestEdge: number,
  corroboratingBooks: number,
): { reliability: 'alta' | 'média' | 'baixa'; suspicious: boolean } {
  const suspicious = bestEdge > SUSPICIOUS_EDGE;
  if (suspicious) return { reliability: 'baixa', suspicious: true };
  const twoSharpsAgree = fair.sharps >= 2 && fair.divergence <= HIGH_DIVERGENCE;
  if (twoSharpsAgree && corroboratingBooks >= 2) return { reliability: 'alta', suspicious: false };
  if (fair.sharps >= 2 && fair.divergence > HIGH_DIVERGENCE)
    return { reliability: 'baixa', suspicious: false }; // sharps discordam
  if (twoSharpsAgree || corroboratingBooks >= 2) return { reliability: 'média', suspicious: false };
  return { reliability: 'baixa', suspicious: false }; // 1 sharp + 1 casa
}

/**
 * Avalia um mercado e devolve as value bets (uma por seleção que tenha ≥ 1
 * casa-alvo a cotá-la). Inclui seleções neutras/−EV também? Não: só devolve
 * linhas cujo MELHOR edge entre as casas-alvo cumpre o limiar. Isto mantém o
 * feed focado em +EV. (Para análise podes baixar o limiar a 0.)
 */
export function evaluateMarket(
  snap: MarketSnapshot,
  config: EngineConfig,
  previous?: Map<string, ValueBet>,
): ValueBet[] {
  const fairs = computeConsensusFair(snap, config.sharpSource, config.devigMethod);
  if (!fairs) return [];

  const fairBySel = new Map(fairs.map((f) => [f.selectionId, f]));
  const out: ValueBet[] = [];
  const now = new Date().toISOString();

  for (const sel of snap.selections) {
    const fair = fairBySel.get(sel.id);
    if (!fair) continue;

    // Cotações das casas-alvo ativas para esta seleção.
    const quotes: Array<{ book: TargetBook; odd: number }> = [];
    for (const book of config.activeBooks) {
      const q = snap.quotes[book as BookId]?.[sel.id];
      if (q && q.odd > 1) quotes.push({ book, odd: q.odd });
    }
    if (quotes.length === 0) continue;

    const books: BookEdge[] = quotes.map((q) => {
      const e = expectedValue(fair.prob, q.odd);
      return {
        book: q.book,
        odd: q.odd,
        edge: e,
        isValue: e >= config.edgeThreshold,
        deepLink: deepLinkFor(q.book, snap, sel),
      };
    });

    // Entra no feed qualquer seleção que tenha pelo menos uma cotação de uma
    // casa-alvo — INCLUINDO edge negativo. O filtro de edge mínimo do feed
    // (slider, que aceita valores negativos) é o único controlo do que se vê.
    // Assim as odds da Betclic também aparecem quando ela cota, mesmo -EV.
    // (já garantido acima: quotes.length > 0)

    const shop = lineShop(
      fair.prob,
      quotes.map((q) => ({ book: q.book, odd: q.odd })),
      config.edgeThreshold,
    );
    const bestBook = shop.bestBook as TargetBook;
    const bestOdd = shop.bestOdd;
    const bestEdge = shop.bestEdge;

    const k = kelly({
      prob: fair.prob,
      odd: bestOdd,
      fraction: config.kellyFraction,
      bankroll: config.bankroll,
      cap: config.stakeCap,
    });

    const id = sel.id; // estável: mesmo mercado+seleção
    const prev = previous?.get(id);
    const corroborating = books.filter((b) => b.edge > 0).length;
    const { reliability, suspicious } = rateReliability(fair, bestEdge, corroborating);

    out.push({
      id,
      event: snap.event,
      selection: sel,
      fair,
      books: books.sort((a, b) => b.edge - a.edge),
      bestBook,
      bestOdd,
      bestEdge,
      kellyFraction: k.fraction,
      stake: k.stake,
      // Preserva o "detetado em" se a aposta já existia → mede frescura real.
      detectedAt: prev?.detectedAt ?? now,
      updatedAt: now,
      reliability,
      suspicious,
    });
  }

  return out;
}

/**
 * Avalia vários mercados e devolve o feed completo ordenado por edge desc.
 * `previous` permite preservar o detectedAt entre ciclos (atualização
 * incremental, não recriação).
 */
export function evaluateFeed(
  snaps: MarketSnapshot[],
  config: EngineConfig,
  previous?: Map<string, ValueBet>,
): ValueBet[] {
  const all: ValueBet[] = [];
  for (const snap of snaps) {
    all.push(...evaluateMarket(snap, config, previous));
  }
  return all.sort((a, b) => b.bestEdge - a.bestEdge);
}
