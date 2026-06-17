/**
 * Análise — escolhe um dos próximos jogos (Mundial) e vê: melhores odds +EV,
 * stats reais das equipas (API-Football) e uma visão AI (Claude, opcional).
 */
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import {
  analyzeGame,
  gamePreview,
  upcomingEvents,
  bestValueGame,
  selectionConfidence,
  type GameAnalysis,
} from '../lib/gameAnalysis';
import { getMatchupStats, hasApiFootballKey, type MatchupStats, type LiveTeamTrends } from '../data/apiFootball';
import {
  getAIAnalysis,
  buildPrompt,
  localAnalysis,
  buildDailyPrompt,
  localDailyBriefing,
} from '../data/aiAnalysis';
import { ACCOUNT_BOOK_META } from '../lib/types';
import { odd as fmtOdd, pct, shortTime, signedPct } from '../lib/format';
import { mdToHtml } from '../lib/markdown';

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
  const best = useMemo(() => bestValueGame(snapshots, config), [snapshots, config]);

  if (events.length === 0) {
    return (
      <div className="empty">
        Sem jogos com odds de momento. Liga o The Odds API (modo dados reais) e aguarda o varrimento.
      </div>
    );
  }

  return (
    <div>
      <DailyBriefing />

      {best && best.eventId !== selId && (
        <div
          className="note ok"
          style={{ marginTop: 0, cursor: 'pointer' }}
          onClick={() => setEventId(best.eventId)}
        >
          ⭐ <strong>Jogo do dia:</strong> {best.home} v {best.away} — melhor valor em{' '}
          {best.topMarket} ({best.topLabel}, +{signedPct(best.topEdge)}). Toca para analisar.
        </div>
      )}

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
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiLocal, setAiLocal] = useState(false);

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
    setAiLocal(false);
    const s = stats ?? (hasApiFootballKey() ? await loadStats() : null);
    try {
      const r = await getAIAnalysis(buildPrompt(a, s), true); // web search ligado
      setAi(r.text);
      setAiSources(r.sources ?? []);
    } catch (e) {
      const msg = (e as Error).message;
      // sem chave de IA configurada → análise automática local (sem IA)
      if (/sem chave|503/i.test(msg)) {
        setAi(localAnalysis(a, s));
        setAiLocal(true);
      } else {
        setAiErr(msg);
      }
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
      {a.topBets.length > 0 && (() => {
        const c = selectionConfidence(a.topBets[0]);
        return (
          <div className={`note ${c.level === 'baixa' ? 'danger' : c.level === 'alta' ? 'ok' : ''}`}>
            Confiança da melhor sugestão: <strong>{c.level}</strong> — {c.reason}.
          </div>
        );
      })()}

      <div className="section-title">Stats das equipas</div>
      {!hasApiFootballKey() ? (
        <div className="muted" style={{ fontSize: 12 }}>
          Define <code>VITE_API_FOOTBALL_KEY</code> para carregar forma, golos, over% e h2h.
        </div>
      ) : !stats ? (
        <button className="btn" onClick={loadStats} disabled={statsLoading}>
          {statsLoading ? 'A carregar…' : '↻ Carregar stats reais'}
        </button>
      ) : !stats.home && !stats.away ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {stats.remaining === 0
            ? 'Sem stats: quota diária da API-Football esgotada (reseta 00:00 UTC).'
            : 'Sem stats disponíveis para estas equipas.'}
        </div>
      ) : (
        <div className="grid-2" style={{ gap: 8 }}>
          {stats.home && <StatBox t={stats.home} fallback={a.event.home} />}
          {stats.away && <StatBox t={stats.away} fallback={a.event.away} />}
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

      <div className="section-title">Visão AI 🤖 (com pesquisa na net)</div>
      <div className="panel">
        <div style={{ padding: 14 }}>
          {!ai && (
            <button className="btn primary" onClick={runAI} disabled={aiLoading}>
              {aiLoading ? 'A pesquisar e analisar…' : 'Analisar jogo (tipsters + notícias)'}
            </button>
          )}
          {aiErr && (
            <div className="note danger" style={{ marginTop: ai ? 0 : 10 }}>{aiErr}</div>
          )}
          {aiLocal && (
            <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
              análise automática (sem IA) — define GEMINI_API_KEY (grátis) no servidor para a visão AI com pesquisa.
            </div>
          )}
          {ai && <div className="ai-text" dangerouslySetInnerHTML={{ __html: mdToHtml(ai) }} />}
          {ai && aiSources.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="detail-title">Fontes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {aiSources.map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                    ↗ {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
          {ai && (
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={runAI} disabled={aiLoading}>
              {aiLoading ? 'A pensar…' : '↻ Regenerar'}
            </button>
          )}
        </div>
      </div>

      <div className="note">
        Opinião gerada a partir das odds e stats — não é garantia. Aposta com responsabilidade.
      </div>
    </div>
  );
}

function DailyBriefing() {
  const valueBets = useStore((s) => s.valueBets);
  const top = useMemo(
    () => valueBets.filter((b) => b.bestEdge > 0).slice(0, 10),
    [valueBets],
  );
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [local, setLocal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    setLocal(false);
    try {
      const r = await getAIAnalysis(buildDailyPrompt(top));
      setText(r.text);
    } catch (e) {
      const msg = (e as Error).message;
      if (/sem chave|503/i.test(msg)) {
        setText(localDailyBriefing(top));
        setLocal(true);
      } else setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-h" style={{ justifyContent: 'space-between' }}>
        <span>🤖 Resumo do dia (AI)</span>
        <span className="muted mono">{top.length} apostas com valor</span>
      </div>
      <div style={{ padding: 14 }}>
        {!text && (
          <button className="btn primary" onClick={run} disabled={loading || top.length === 0}>
            {loading ? 'A pensar…' : top.length === 0 ? 'Sem apostas com valor agora' : 'O que apostar hoje?'}
          </button>
        )}
        {err && <div className="note danger">{err}</div>}
        {local && (
          <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
            resumo automático (sem IA) — define GEMINI_API_KEY (grátis) no servidor para a visão AI.
          </div>
        )}
        {text && <div className="ai-text" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />}
        {text && (
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={run} disabled={loading}>
            {loading ? 'A pensar…' : '↻ Regenerar'}
          </button>
        )}
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
