/** Formatação de datas/horas do RATING ROYALE. Dias agrupados no fuso dos EUA. */
import { USA_TZ } from './config';

/** Data de hoje (YYYY-MM-DD) no fuso dos EUA. */
export function usTodayStr(now = new Date()): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: USA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return f.format(now); // en-CA → YYYY-MM-DD
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
