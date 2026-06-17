/**
 * Análise — escolhe um dos próximos jogos (Mundial) e vê: melhores odds +EV,
 * stats reais das equipas (API-Football) e uma visão AI (Claude, opcional).
 */
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { analyzeGame, gamePreview, upcomingEvents, type GameAnalysis } from '../lib/gameAnalysis';
import { getMatchupStats, hasApiFootballKey, type MatchupStats, type LiveTeamTrends } from '../data/apiFootball';
import { getAIAnalysis, buildPrompt } from '../data/aiAnalysis';
import { ACCOUNT_BOOK_META } from '../lib/types';
import { odd as fmtOdd, pct, shortTime, signedPct } from '../lib/format';

export function Analysis() {
  const snapshots = useStore((s) => s.snapshots);
  const config = useStore((s) => s.config);

  const events = useMemo(() => upcomingEvents(snapshots, 10), [snapshots]);
  const [eventId, setEventId] = useState<string>('');
  const selId = events.find((e) => e.id === eventId)?.id ?? events[0]?.id ?? '';
  const analysis = useMemo(
    () => (selId ? analyzeGame(snapshots, selId, config) : null),
    [snapshots, selId, config],
  );

  if (events.length === 0) {
    return (
      <div className="empty">
        Sem jogos com odds de momento. Liga o The Odds API (modo dados reais) e aguarda o varrimento.
      </div>
    );
  }

  return (
    <div>
      <div className="filters">
        <div className="field" style={{ flex: 1, minWidth: 240 }}>
          <label>Próximos jogos</label>
          <select value={selId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.home} v {ev.away} · {shortTime(ev.startsAt)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {analysis && <GameView a={analysis} />}
    </div>
  );
}

function GameView({ a }: { a: GameAnalysis }) {
  const [stats, setStats] = useState<MatchupStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [ai, setAi] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const loadStats = async (): Promise<MatchupStats | null> => {
    setStatsLoading(true);
    try {
      const s = await getMatchupStats(a.event.home, a.event.away);
      setStats(s);
      return s;
    } catch {
      return null;
    } finally {
      setStatsLoading(false);
    }
  };

  const runAI = async () => {
    setAiLoading(true);
    setAiErr(null);
    try {
      const s = stats ?? (hasApiFootballKey() ? await loadStats() : null);
      setAi(await getAIAnalysis(buildPrompt(a, s)));
    } catch (e) {
      setAiErr((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-h" style={{ justifyContent: 'space-between' }}>
          <span>{a.event.league} · {shortTime(a.event.startsAt)}</span>
          <span className="muted mono">{a.markets.length} mercados</span>
        </div>
        <div style={{ padding: 14, textAlign: 'center' }} className="mono">
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            {a.event.home} <span className="dim">vs</span> {a.event.away}
          </span>
        </div>
      </div>

      <GamePreview a={a} />

      <div className="section-title">Sugestões de mercado com mais valor</div>
      {a.topBets.length === 0 ? (
        <div className="note">Sem valor positivo de momento neste jogo (a fonte grátis pode não cobrir todos os mercados).</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="l">Mercado</th>
                <th className="l">Seleção</th>
                <th>Justa</th>
                <th>Melhor</th>
                <th>Edge</th>
                <th className="l hide-sm">Porquê</th>
              </tr>
            </thead>
            <tbody>
              {a.topBets.slice(0, 12).map((b) => (
                <tr key={b.selectionId}>
                  <td className="l"><span className="market-chip">{b.marketLabel}</span></td>
                  <td className="l sel-cell">{b.label}</td>
                  <td className="mono neu">{fmtOdd(b.fairOdd)}</td>
                  <td className="mono pos">
                    {b.bestBook ? ACCOUNT_BOOK_META[b.bestBook].label : '—'} {fmtOdd(b.bestOdd)}
                  </td>
                  <td className="mono pos">{signedPct(b.bestEdge)}</td>
                  <td className="l muted hide-sm" style={{ fontSize: 12 }}>
                    paga {fmtOdd(b.bestOdd)} vs justo {fmtOdd(b.fairOdd)} → +{signedPct(b.bestEdge)} de valor
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title">Stats das equipas</div>
      {!hasApiFootballKey() ? (
        <div className="muted" style={{ fontSize: 12 }}>
          Define <code>VITE_API_FOOTBALL_KEY</code> para carregar forma, golos, over% e h2h.
        </div>
      ) : !stats ? (
        <button className="btn" onClick={loadStats} disabled={statsLoading}>
          {statsLoading ? 'A carregar…' : '↻ Carregar stats reais'}
        </button>
      ) : (
        <div className="grid-2" style={{ gap: 8 }}>
          <StatBox t={stats.home} fallback={a.event.home} />
          <StatBox t={stats.away} fallback={a.event.away} />
        </div>
      )}
      {stats?.h2h && stats.h2h.played > 0 && (
        <div className="calc-row" style={{ marginTop: 6 }}>
          <span className="lbl">Head-to-head ({stats.h2h.played})</span>
          <span className="val mono">{stats.h2h.homeWins}V {stats.h2h.draws}E {stats.h2h.awayWins}D · {stats.h2h.avgGoals} golos</span>
        </div>
      )}
      {stats && stats.remaining === 0 && (
        <div className="note danger" style={{ marginTop: 6 }}>
          Quota diária da API-Football esgotada (100/dia) — reseta às 00:00 UTC.
        </div>
      )}

      <div className="section-title">Visão AI 🤖</div>
      <div className="panel">
        <div style={{ padding: 14 }}>
          {!ai && (
            <button className="btn primary" onClick={runAI} disabled={aiLoading}>
              {aiLoading ? 'A pensar…' : 'Gerar visão AI do jogo'}
            </button>
          )}
          {aiErr && (
            <div className="note danger" style={{ marginTop: ai ? 0 : 10 }}>
              {aiErr.includes('ANTHROPIC')
                ? 'Visão AI desativada: define ANTHROPIC_API_KEY no servidor (Vercel) para ativar.'
                : aiErr}
            </div>
          )}
          {ai && <div className="ai-text">{ai}</div>}
          {ai && (
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={runAI} disabled={aiLoading}>
              {aiLoading ? 'A pensar…' : '↻ Regenerar'}
            </button>
          )}
        </div>
      </div>

      <div className="note">
        A visão AI é uma opinião gerada por modelo a partir das odds e stats — não é garantia.
        Aposta com responsabilidade.
      </div>
    </div>
  );
}

function GamePreview({ a }: { a: GameAnalysis }) {
  const p = gamePreview(a);
  const favName =
    p.favorite === 'home' ? a.event.home : p.favorite === 'away' ? a.event.away : 'Empate';
  const overText =
    p.overProb != null
      ? `Tendência de golos: Over ${p.overLine} a ${pct(p.overProb, 0)} (${p.overProb >= 0.5 ? 'jogo aberto' : 'jogo fechado'}).`
      : 'Tendência de golos: sem linha de totais na fonte para este jogo.';
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-h">Como deve ser o jogo</div>
      <div style={{ padding: 14 }}>
        <div className="calc-row">
          <span className="lbl">Resultado (prob. justas)</span>
          <span className="val mono">
            {a.event.home} {pct(p.homeProb, 0)} · X {pct(p.drawProb, 0)} · {a.event.away} {pct(p.awayProb, 0)}
          </span>
        </div>
        <div style={{ marginTop: 8, lineHeight: 1.6 }}>
          <strong>{favName}</strong> {p.balance === 'jogo equilibrado' ? '— ' : 'é '}
          {p.balance}. {overText}
        </div>
      </div>
    </div>
  );
}

function StatBox({ t, fallback }: { t: LiveTeamTrends | null; fallback: string }) {
  if (!t)
    return (
      <div className="stat" style={{ padding: 10 }}>
        <div className="k">{fallback}</div>
        <div className="muted" style={{ fontSize: 11 }}>sem dados</div>
      </div>
    );
  return (
    <div className="stat" style={{ padding: 10 }}>
      <div className="k" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{t.team}</span>
        <span style={{ display: 'flex', gap: 2 }}>
          {t.form.slice(0, 5).map((r, i) => (
            <span key={i} className={`form-dot ${r === 'W' ? 'pos' : r === 'L' ? 'neg' : 'neu'}`}>{r}</span>
          ))}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
        golos {t.gfAvg}/{t.gaAvg} · over2.5 {pct(t.over25Pct, 0)} · btts {pct(t.bttsPct, 0)} · cs {pct(t.cleanSheetPct, 0)}
      </div>
    </div>
  );
}
