/**
 * Cliente da visão AI (chama a Edge Function /api/ai-analysis → Claude).
 * Constrói o prompt a partir da análise do jogo + stats das equipas.
 */
import { gamePreview, type GameAnalysis } from '../lib/gameAnalysis';
import type { MatchupStats } from './apiFootball';
import type { ValueBet } from '../lib/types';
import { signedPct, odd as fmtOdd, pct } from '../lib/format';

/** Prompt para o RESUMO DO DIA — as melhores apostas +EV do Mundial. */
export function buildDailyPrompt(bets: ValueBet[]): string {
  const lines: string[] = [];
  lines.push('Estas são as apostas de futebol com valor (+EV) detetadas agora, ordenadas por edge:');
  lines.push('');
  for (const b of bets.slice(0, 10)) {
    lines.push(
      `• ${b.event.home} v ${b.event.away} — ${b.selection.label}: ` +
        `${b.bestBook.toUpperCase()} @ ${fmtOdd(b.bestOdd)} (justa ${fmtOdd(b.fair.fairOdd)}, ` +
        `edge ${signedPct(b.bestEdge)}, fiabilidade ${b.reliability}${b.suspicious ? ', SUSPEITA' : ''})`,
    );
  }
  lines.push('');
  lines.push(
    'Faz um resumo curado: as 2-3 apostas com melhor valor REAL e porquê, quais evitar (ex.: fiabilidade baixa ou edge suspeito), e o destaque do dia. Sê conciso e honesto.',
  );
  return lines.join('\n');
}

/** Resumo do dia DETERMINÍSTICO (sem IA). */
export function localDailyBriefing(bets: ValueBet[]): string {
  if (bets.length === 0) return 'Sem apostas com valor positivo de momento. Baixa o edge mínimo ou aguarda.';
  const parts: string[] = [];
  const reliable = bets.filter((b) => b.reliability !== 'baixa' && !b.suspicious);
  const top = (reliable.length ? reliable : bets).slice(0, 3);
  parts.push('Melhor valor agora:');
  for (const b of top) {
    parts.push(
      `• ${b.event.home} v ${b.event.away} — ${b.selection.label}: ${b.bestBook.toUpperCase()} @ ${fmtOdd(b.bestOdd)} ` +
        `(edge ${signedPct(b.bestEdge)}, fiabilidade ${b.reliability}).`,
    );
  }
  const suspicious = bets.filter((b) => b.suspicious || b.reliability === 'baixa');
  if (suspicious.length) {
    parts.push('');
    parts.push(`A evitar / cautela: ${suspicious.length} aposta(s) de baixa fiabilidade ou edge suspeito (provável erro de odd).`);
  }
  parts.push('');
  parts.push('Edges pequenos exigem volume. Aposta com responsabilidade.');
  return parts.join('\n');
}

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

/** Prompt RICO e fundamentado para a análise de UM jogo. */
export function buildPrompt(a: GameAnalysis, stats: MatchupStats | null): string {
  const p = gamePreview(a);
  const L: string[] = [];

  L.push(`# Jogo: ${a.event.home} vs ${a.event.away} — ${a.event.league}`);
  L.push('');
  L.push('## Probabilidades justas (de-vig por consenso Pinnacle+Betfair)');
  L.push(
    `${a.event.home} ${pct(p.homeProb, 0)} · Empate ${pct(p.drawProb, 0)} · ${a.event.away} ${pct(p.awayProb, 0)} ` +
      `(${p.balance}).` +
      (p.overProb != null ? ` Over ${p.overLine}: ${pct(p.overProb, 0)}.` : ''),
  );

  L.push('');
  L.push('## Apostas com valor (+EV) — com FIABILIDADE');
  L.push('(fiabilidade = consenso de sharps + nº de casas; "suspeita" = edge implausível, provável erro de odd)');
  if (a.topBets.length === 0) {
    L.push('— nenhuma com edge positivo de momento.');
  } else {
    for (const b of a.topBets.slice(0, 8)) {
      L.push(
        `- ${b.marketLabel} — ${b.label}: ${b.bestBook?.toUpperCase()} @ ${fmtOdd(b.bestOdd)} ` +
          `(justa ${fmtOdd(b.fairOdd)}, edge ${signedPct(b.bestEdge)}, ` +
          `${b.sharps} sharp${b.sharps > 1 ? 's' : ''}, fiabilidade ${b.reliability}` +
          `${b.suspicious ? ', SUSPEITA' : ''})`,
      );
    }
  }

  if (stats?.home || stats?.away) {
    L.push('');
    L.push('## Estatísticas reais (últimos jogos, API-Football)');
    const fmtTeam = (t: NonNullable<MatchupStats['home']>) =>
      `${t.team}: forma ${t.form.join('') || '—'}; golos ${t.gfAvg} marcados / ${t.gaAvg} sofridos por jogo; ` +
      `over1.5 ${pct(t.over15Pct, 0)}, over2.5 ${pct(t.over25Pct, 0)}; ` +
      `ambas marcam ${pct(t.bttsPct, 0)}; clean sheet ${pct(t.cleanSheetPct, 0)}.`;
    if (stats.home) L.push(`- ${fmtTeam(stats.home)}`);
    if (stats.away) L.push(`- ${fmtTeam(stats.away)}`);
    if (stats.h2h && stats.h2h.played > 0)
      L.push(
        `- Head-to-head (${stats.h2h.played}): ${stats.h2h.homeWins}V ${stats.h2h.draws}E ${stats.h2h.awayWins}D, ` +
          `${stats.h2h.avgGoals} golos/jogo${stats.h2h.results.length ? ` (recentes: ${stats.h2h.results.slice(0, 5).join(', ')})` : ''}.`,
      );
  } else {
    L.push('');
    L.push('## Estatísticas: não carregadas (sem chave API-Football ou quota esgotada).');
  }

  L.push('');
  L.push('## Limitações de dados (importante para seres honesto)');
  L.push(
    'Fonte: The Odds API (grátis). Nestes jogos do Mundial normalmente só o 1xBet cota e a Betclic não está disponível, ' +
      'logo há pouca corroboração entre casas. Edges de fiabilidade baixa ou suspeitos devem ser tratados com ceticismo.',
  );

  L.push('');
  L.push('## O que quero de ti (responde com estas secções)');
  L.push('1) **Leitura do jogo** — favorito, equilíbrio, golos esperados, com base nas probabilidades + forma + h2h.');
  L.push('2) **Onde está o valor** — escolhe as 1-2 apostas com melhor valor REAL (cruza edge × fiabilidade × stats). Justifica.');
  L.push('3) **A evitar** — apostas suspeitas / fiabilidade baixa / contra a forma.');
  L.push('4) **Veredicto** — 1 frase + nível de confiança (alto/médio/baixo).');
  L.push('Sê específico e fundamentado nos números dados; não inventes dados. Termina com nota curta de jogo responsável.');

  return L.join('\n');
}
