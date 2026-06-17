/**
 * Cliente da visão AI (chama a Edge Function /api/ai-analysis → Claude).
 * Constrói o prompt a partir da análise do jogo + stats das equipas.
 */
import type { GameAnalysis } from '../lib/gameAnalysis';
import type { MatchupStats } from './apiFootball';
import { signedPct, odd as fmtOdd, pct } from '../lib/format';

export async function getAIAnalysis(prompt: string): Promise<string> {
  const res = await fetch('/api/ai-analysis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `HTTP ${res.status}`);
  }
  const { text } = (await res.json()) as { text: string };
  return text;
}

/** Resume a análise + stats num prompt legível para o modelo. */
export function buildPrompt(a: GameAnalysis, stats: MatchupStats | null): string {
  const lines: string[] = [];
  lines.push(`Jogo: ${a.event.home} vs ${a.event.away} (${a.event.league}).`);
  lines.push('');
  lines.push('Melhores apostas com valor (+EV), odd da casa e edge:');
  if (a.topBets.length === 0) {
    lines.push('— nenhuma com edge positivo de momento.');
  } else {
    for (const b of a.topBets.slice(0, 8)) {
      lines.push(
        `• ${b.marketLabel} — ${b.label}: ${b.bestBook?.toUpperCase()} @ ${fmtOdd(b.bestOdd)} ` +
          `(justa ${fmtOdd(b.fairOdd)}, edge ${signedPct(b.bestEdge)})`,
      );
    }
  }
  if (stats?.home || stats?.away) {
    lines.push('');
    lines.push('Estatísticas (últimos jogos):');
    if (stats.home)
      lines.push(
        `${stats.home.team}: forma ${stats.home.form.join('')}, golos ${stats.home.gfAvg}/${stats.home.gaAvg}, ` +
          `over2.5 ${pct(stats.home.over25Pct, 0)}, btts ${pct(stats.home.bttsPct, 0)}.`,
      );
    if (stats.away)
      lines.push(
        `${stats.away.team}: forma ${stats.away.form.join('')}, golos ${stats.away.gfAvg}/${stats.away.gaAvg}, ` +
          `over2.5 ${pct(stats.away.over25Pct, 0)}, btts ${pct(stats.away.bttsPct, 0)}.`,
      );
    if (stats.h2h && stats.h2h.played > 0)
      lines.push(
        `Head-to-head (${stats.h2h.played}): ${stats.h2h.homeWins}V ${stats.h2h.draws}E ${stats.h2h.awayWins}D, ${stats.h2h.avgGoals} golos/jogo.`,
      );
  }
  lines.push('');
  lines.push('Dá a tua visão e onde está o melhor valor.');
  return lines.join('\n');
}
