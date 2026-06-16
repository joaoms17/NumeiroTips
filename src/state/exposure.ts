/**
 * Tracker de exposição por casa + sinal de risco.
 *
 * Honestidade de conta:
 *  - Betclic (licenciada SRIJ): segura, mas limita vencedores consistentes →
 *    manter stakes discretos e arredondados.
 *  - 1xBet (zona cinzenta): risco regulatório/de levantamento → não acumular
 *    saldo, levantar com frequência.
 *
 * "Exposição" aqui = stake pendente (em risco) + lucro acumulado retido por
 * casa. Sinalizamos risco quando ultrapassa limites configuráveis.
 */
import type { TrackedBet, TargetBook } from '../lib/types';
import { BOOK_META } from '../lib/types';

export interface BookExposure {
  book: TargetBook;
  label: string;
  risk: 'licenciada' | 'cinzenta';
  /** Stake em apostas pendentes (em risco agora). */
  pending: number;
  /** P/L liquidado acumulado nesta casa (proxy de saldo retido). */
  settledPnl: number;
  /** Nº de apostas pendentes. */
  pendingCount: number;
  /** True se ultrapassa limite → mostrar alerta. */
  atRisk: boolean;
  reason?: string;
}

export interface ExposureLimits {
  /** Stake pendente máximo por casa antes de avisar. */
  maxPending: number;
  /** Saldo retido máximo na 1xBet antes de sugerir levantamento. */
  maxGreyBalance: number;
}

export const DEFAULT_EXPOSURE_LIMITS: ExposureLimits = {
  maxPending: 200,
  maxGreyBalance: 150,
};

export function computeExposure(
  bets: TrackedBet[],
  limits: ExposureLimits = DEFAULT_EXPOSURE_LIMITS,
): BookExposure[] {
  const books: TargetBook[] = ['betclic', '1xbet'];
  return books.map((book) => {
    const mine = bets.filter((b) => b.book === book);
    const pendingBets = mine.filter((b) => b.result === 'pending');
    const pending = round2(pendingBets.reduce((s, b) => s + b.stake, 0));
    const settledPnl = round2(
      mine.filter((b) => b.result !== 'pending').reduce((s, b) => s + (b.pnl ?? 0), 0),
    );
    const meta = BOOK_META[book];

    let atRisk = false;
    let reason: string | undefined;
    if (pending > limits.maxPending) {
      atRisk = true;
      reason = `Exposição pendente ${pending}€ acima do limite (${limits.maxPending}€)`;
    }
    if (meta.risk === 'cinzenta' && settledPnl > limits.maxGreyBalance) {
      atRisk = true;
      reason = `Saldo retido ${settledPnl}€ na 1xBet — considera levantar`;
    }

    return {
      book,
      label: meta.label,
      risk: meta.risk,
      pending,
      settledPnl,
      pendingCount: pendingBets.length,
      atRisk,
      reason,
    };
  });
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
