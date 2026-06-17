/**
 * Cliente da visão AI (chama a Edge Function /api/ai-analysis → Claude).
 * Constrói o prompt a partir da análise do jogo + stats das equipas.
 */
import { gamePreview, type GameAnalysis } from '../lib/gameAnalysis';
import type { MatchupStats } from './apiFootball';
import { signedPct, odd as fmtOdd, pct } from '../lib/format';

/**
 * Análise automática DETERMINÍSTICA (sem IA) — funciona sem chave nenhuma.
 * Lê o preview do jogo + as melhores apostas + stats e escreve um resumo.
 */
export function localAnalysis(a: GameAnalysis, stats: MatchupStats | null): string {
  const p = gamePreview(a);
  const fav =
    p.favorite === 'home' ? a.event.home : p.favorite === 'away' ? a.event.away : 'o empate';
  const parts: string[] = [];
  parts.push(
    `${a.event.home} vs ${a.event.away}: ${fav} ${p.balance === 'jogo equilibrado' ? '— jogo equilibrado' : `é ${p.balance}`} ` +
      `(${a.event.home} ${pct(p.homeProb, 0)} · X ${pct(p.drawProb, 0)} · ${a.event.away} ${pct(p.awayProb, 0)}).`,
  );
  if (p.overProb != null) {
    parts.push(
      `Tendência de golos: Over ${p.overLine} a ${pct(p.overProb, 0)} — ${p.overProb >= 0.5 ? 'aponta a jogo aberto' : 'aponta a jogo fechado'}.`,
    );
  }
  if (stats?.home && stats?.away) {
    parts.push(
      `Forma: ${stats.home.team} ${stats.home.form.join('')} (${stats.home.gfAvg}/${stats.home.gaAvg} golos), ` +
        `${stats.away.team} ${stats.away.form.join('')} (${stats.away.gfAvg}/${stats.away.gaAvg}).`,
    );
  }
  if (a.topBets.length > 0) {
    const t = a.topBets[0];
    parts.push(
      `Melhor valor: ${t.marketLabel} — ${t.label} (${t.bestBook?.toUpperCase()} @ ${fmtOdd(t.bestOdd)}, edge ${signedPct(t.bestEdge)}). ` +
        `Paga acima do justo (${fmtOdd(t.fairOdd)}).`,
    );
    if (t.books.length < 2) parts.push('⚠ Confiança baixa: só uma casa a cotar, sem corroboração.');
  } else {
    parts.push('Sem valor positivo claro neste jogo de momento.');
  }
  parts.push('Edges pequenos exigem volume. Aposta com responsabilidade.');
  return parts.join('\n\n');
}

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
