/** Formatação para a estética "terminal quant" (números monospace, PT). */

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Edge com sinal explícito (+2.3% / −1.1%). */
export function signedPct(x: number, digits = 1): string {
  const v = (x * 100).toFixed(digits);
  return x > 0 ? `+${v}%` : `${v}%`;
}

export function odd(x: number): string {
  return x.toFixed(2);
}

export function eur(x: number | null | undefined): string {
  if (x == null) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(x);
}

export function prob(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** "detetado há Xs" — frescura relativa, curta. */
export function ago(iso: string, nowMs: number = Date.now()): string {
  const diff = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m${diff % 60 > 0 ? ` ${diff % 60}s` : ''}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/** Hora de início curta (ex.: "qua 21:45"). */
export function shortTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export const MARKET_LABELS: Record<string, string> = {
  '1x2': '1X2',
  over_under: 'Over/Under',
  btts: 'Ambas Marcam',
  ah: 'Handicap Asiático',
  dnb: 'Empate Anula',
  all: 'Todos os mercados',
};

export function marketLabel(m: string): string {
  return MARKET_LABELS[m] ?? m;
}
