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

  // Top 3 apostas (a partir do melhor valor disponível na app)
  parts.push('### 🎯 Top 3 apostas para o jogo');
  const top3 = a.topBets.slice(0, 3);
  if (top3.length === 0) {
    parts.push('Sem valor positivo claro nos mercados disponíveis. Liga a IA (GEMINI_API_KEY) para sugestões de mais mercados.');
  } else {
    top3.forEach((b, i) => {
      parts.push(
        `${i + 1}. **${b.marketLabel} — ${b.label}** @ ${fmtOdd(b.bestOdd)} (${b.bestBook?.toUpperCase()}) ` +
          `— edge ${signedPct(b.bestEdge)}, fiabilidade ${b.reliability}${b.suspicious ? ' ⚠' : ''}.`,
      );
    });
  }
  parts.push('');

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
  parts.push('Edges pequenos exigem volume. Aposta com responsabilidade.');
  return parts.join('\n\n');
}

export interface AIResult {
  text: string;
  sources?: Array<{ title: string; uri: string }>;
}

export async function getAIAnalysis(prompt: string, web = false): Promise<AIResult> {
  const res = await fetch('/api/ai-analysis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, web }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as AIResult;
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
  L.push('## Pesquisa na net (IMPORTANTE — usa VÁRIAS fontes)');
  L.push(
    'Faz VÁRIAS pesquisas no Google sobre este jogo e CRUZA o máximo de fontes que conseguires. ' +
      'Não fiques por um site — procura ativamente PÁGINAS DE DICAS/PROGNÓSTICOS e a opinião de vários tipsters, por exemplo:',
  );
  L.push(
    '- Páginas de prognósticos: Forebet, PredictZ, WinDrawWin, OLBG, Betimate, Betensified, ' +
      'Academia das Apostas (PT), Zerozero (PT), Soccer Predictions, Adam Choi / SoccerVista.',
  );
  L.push(
    '- Stats e previsões: SofaScore, WhoScored, FootyStats, FBref, Flashscore (prováveis onzes e forma).',
  );
  L.push(
    '- Opinião da comunidade: Reddit r/SoccerBetting (threads de match/picks), X/Twitter de tipsters, blogs de apostas.',
  );
  L.push(
    '- Notícias recentes (chave): lesões, suspensões, onze provável, rotação, motivação/contexto ' +
      '(fase do torneio, o que cada equipa precisa, calendário). Procura nos media desportivos dos dois países.',
  );
  L.push(
    'Reporta o CONSENSO dessas fontes: quantas apontam para o mesmo lado, onde divergem, e que mercados ' +
      'aparecem repetidos nas dicas. Se a net contradisser as odds/os números, di-lo claramente. ' +
      'Distingue fontes credíveis de ruído; não inventes uma fonte que não viste.',
  );

  L.push('');
  L.push('## O que quero de ti');
  L.push('COMEÇA SEMPRE com esta secção, é o mais importante:');
  L.push('');
  L.push('### 🎯 Top 3 apostas para o jogo');
  L.push(
    'As 3 melhores apostas, de QUALQUER mercado (1X2, dupla hipótese, golos over/under, ambas marcam, ' +
      'handicap, cantos, cartões, marcador, resultado exato, etc.) — não te limites aos mercados da app. ' +
      'Para cada uma: **aposta** — odd aproximada (se souberes) — 1 linha de porquê — confiança (alta/média/baixa). ' +
      'Ordena da mais forte para a mais fraca. Se houver +EV fiável nos dados, dá-lhe prioridade; senão usa a tua leitura + a net.',
  );
  L.push('');
  L.push('Depois disso:');
  L.push('- **Leitura do jogo** (probabilidades + forma + h2h + net).');
  L.push(
    '- **Consenso de dicas (tipsters)** — resume o que dizem as VÁRIAS páginas de prognósticos/tipsters que pesquisaste: ' +
      'para que lado pendem, em que mercados concordam, onde divergem. Menciona as fontes pelo nome (ex.: "Forebet e PredictZ apontam...").',
  );
  L.push('- **Notícias/contexto** (lesões, onze provável, suspensões, motivação).');
  L.push('- **A evitar** (suspeitas / fiabilidade baixa / contra a forma, notícias ou consenso).');
  L.push('- **Veredicto** (1 frase + confiança global).');
  L.push('Sê específico e fundamentado; não inventes dados nem fontes. Termina com nota curta de jogo responsável.');

  return L.join('\n');
}
