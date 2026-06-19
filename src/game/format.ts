/**
 * Formatação de datas/horas do RATING ROYALE.
 * O "dia de futebol" vai das 07:00 às 07:00 do dia seguinte (hora de Portugal):
 * as madrugadas contam para o dia anterior (jogos do dia + reset da roda às 7h).
 */
export const PT_TZ = 'Europe/Lisbon';
const DAY_CUTOFF_H = 7;

function ymdInTz(d: Date, tz = PT_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d); // en-CA → YYYY-MM-DD
}

/** Dia de futebol (YYYY-MM-DD) de um instante: <07:00 conta para o dia anterior. */
export function footballDay(when: string | Date, tz = PT_TZ): string {
  const t = (typeof when === 'string' ? new Date(when) : when).getTime();
  return ymdInTz(new Date(t - DAY_CUTOFF_H * 3_600_000), tz);
}

/** Dia de futebol de hoje (YYYY-MM-DD). */
export function usTodayStr(now = new Date()): string {
  return footballDay(now);
}

/** Rótulo curto de um dia 'YYYY-MM-DD' (ex.: "qua, 18 jun"). */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(d);
}

/** Número do dia (ex.: "18"). */
export function dayNum(day: string): string {
  return day.slice(8, 10);
}

/** Hora local de início (ex.: "20:00"). */
export function kickLabel(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function relToday(day: string, now = new Date()): 'hoje' | 'amanhã' | 'ontem' | null {
  const today = usTodayStr(now);
  if (day === today) return 'hoje';
  const t = new Date(`${today}T12:00:00`).getTime();
  const d = new Date(`${day}T12:00:00`).getTime();
  const diff = Math.round((d - t) / 86_400_000);
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  return null;
}
