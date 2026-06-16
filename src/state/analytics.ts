/**
 * Analítica do tracker — séries e métricas para o Painel.
 * Funções puras sobre as apostas registadas, para serem testáveis.
 */
import type { TrackedBet } from '../lib/types';
import { clvProbEdge } from '../lib/math/clv';

export interface AnalyticsPoint {
  /** índice sequencial (1ª, 2ª, … aposta liquidada). */
  i: number;
  /** timestamp de liquidação (ms). */
  t: number;
  /** P/L acumulado até aqui. */
  cumPnl: number;
}

export interface Analytics {
  settledCount: number;
  pendingCount: number;
  totalStaked: number;
  totalPnl: number;
  roi: number;
  winRate: number;
  /** CLV médio (entre apostas com CLV registado). */
  avgClv: number;
  /** % de apostas que bateram a linha de fecho (CLV > 0). */
  clvBeatRate: number;
  biggestWin: number;
  biggestLoss: number;
  /** Série de P/L acumulado por aposta liquidada (ordem cronológica). */
  pnlSeries: AnalyticsPoint[];
  /** Curva da banca = banca inicial + P/L acumulado. */
  bankrollSeries: number[];
}

function settledChrono(bets: TrackedBet[]): TrackedBet[] {
  return bets
    .filter((b) => b.result !== 'pending' && b.settledAt != null)
    .sort((a, b) => new Date(a.settledAt!).getTime() - new Date(b.settledAt!).getTime());
}

export function computeAnalytics(bets: TrackedBet[], bankroll: number): Analytics {
  const settled = settledChrono(bets);
  const pendingCount = bets.filter((b) => b.result === 'pending').length;

  const totalStaked = round2(settled.reduce((s, b) => s + b.stake, 0));
  const totalPnl = round2(settled.reduce((s, b) => s + (b.pnl ?? 0), 0));
  const roi = totalStaked > 0 ? totalPnl / totalStaked : 0;

  const decided = settled.filter((b) => b.result === 'won' || b.result === 'lost');
  const wins = decided.filter((b) => b.result === 'won').length;
  const winRate = decided.length > 0 ? wins / decided.length : 0;

  const withClv = bets.filter((b) => b.clv != null);
  const avgClv =
    withClv.length > 0 ? withClv.reduce((s, b) => s + (b.clv ?? 0), 0) / withClv.length : 0;
  const clvBeatRate =
    withClv.length > 0 ? withClv.filter((b) => (b.clv ?? 0) > 0).length / withClv.length : 0;

  const pnls = settled.map((b) => b.pnl ?? 0);
  const biggestWin = pnls.length ? round2(Math.max(0, ...pnls)) : 0;
  const biggestLoss = pnls.length ? round2(Math.min(0, ...pnls)) : 0;

  let cum = 0;
  const pnlSeries: AnalyticsPoint[] = settled.map((b, idx) => {
    cum = round2(cum + (b.pnl ?? 0));
    return { i: idx + 1, t: new Date(b.settledAt!).getTime(), cumPnl: cum };
  });
  const bankrollSeries = [bankroll, ...pnlSeries.map((p) => round2(bankroll + p.cumPnl))];

  return {
    settledCount: settled.length,
    pendingCount,
    totalStaked,
    totalPnl,
    roi,
    winRate,
    avgClv,
    clvBeatRate,
    biggestWin,
    biggestLoss,
    pnlSeries,
    bankrollSeries,
  };
}

/** CLV implícito a partir de uma aposta e da odd justa de fecho (utilidade). */
export function impliedClvEdge(oddBet: number, fairClosingOdd: number): number {
  return clvProbEdge(oddBet, 1 / fairClosingOdd);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
