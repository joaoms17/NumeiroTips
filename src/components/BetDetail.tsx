/**
 * Detalhe de uma value bet — o posto de decisão por jogo:
 * matemática (justo vs casa, edge, Kelly), links de estatísticas externas do
 * jogo REAL (FlashScore/ZeroZero/SofaScore) e um campo de análise pessoal.
 */
import { useState } from 'react';
import { useStore } from '../state/store';
import { useLocalNote } from '../hooks/useLocalNote';
import { matchExternalLinks } from '../lib/externalStats';
import {
  getMatchupStats,
  hasApiFootballKey,
  type MatchupStats,
  type LiveTeamTrends,
} from '../data/apiFootball';
import { BOOK_META } from '../lib/types';
import type { ValueBet } from '../lib/types';
import { eur, odd as fmtOdd, pct, prob, signedPct } from '../lib/format';

function LiveStats({ vb }: { vb: ValueBet }) {
  const [stats, setStats] = useState<MatchupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      setStats(await getMatchupStats(vb.event.home, vb.event.away));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasApiFootballKey()) {
    return (
      <div className="muted" style={{ fontSize: 12 }}>
        Stats automáticas: define <code>VITE_API_FOOTBALL_KEY</code> (api-football grátis) para
        carregares forma, golos, over% e h2h das equipas reais.
      </div>
    );
  }

  if (!stats) {
    return (
      <button className="btn" onClick={load} disabled={loading}>
        {loading ? 'A carregar…' : '↻ Carregar stats reais (API-Football)'}
      </button>
    );
  }

  return (
    <div>
      <div className="grid-2" style={{ gap: 8 }}>
        <TeamTrendBox t={stats.home} fallback={vb.event.home} />
        <TeamTrendBox t={stats.away} fallback={vb.event.away} />
      </div>
      {stats.h2h && stats.h2h.played > 0 && (
        <div className="calc-row" style={{ marginTop: 6 }}>
          <span className="lbl">Head-to-head ({stats.h2h.played})</span>
          <span className="val mono">
            {stats.h2h.homeWins}V {stats.h2h.draws}E {stats.h2h.awayWins}D · {stats.h2h.avgGoals} golos/jogo
          </span>
        </div>
      )}
      {stats.remaining === 0 ? (
        <div className="note danger" style={{ marginTop: 6 }}>
          Quota diária da API-Football esgotada (100/dia) — reseta às 00:00 UTC.
        </div>
      ) : (
        stats.remaining != null && (
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {stats.remaining} pedidos restantes hoje (API-Football)
          </div>
        )
      )}
      {err && <div className="neg" style={{ fontSize: 12 }}>{err}</div>}
    </div>
  );
}

function TeamTrendBox({ t, fallback }: { t: LiveTeamTrends | null; fallback: string }) {
  if (!t) return <div className="stat" style={{ padding: 10 }}><div className="k">{fallback}</div><div className="muted" style={{ fontSize: 11 }}>sem dados</div></div>;
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

export function BetDetail({ vb }: { vb: ValueBet }) {
  const placeBet = useStore((s) => s.placeBet);
  const [note, setNote] = useLocalNote(vb.event.id);
  const links = matchExternalLinks(vb.event.home, vb.event.away);

  return (
    <div className="bet-detail">
      <div className="detail-title">Stats das equipas (jogo real)</div>
      <LiveStats vb={vb} />
      <div className="link-row" style={{ marginTop: 8 }}>
        {links.map((l) => (
          <a key={l.name} className="btn ghost" href={l.url} target="_blank" rel="noreferrer">
            {l.name} ↗
          </a>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
        <div>
          <div className="detail-title">Matemática</div>
          <DetRow
            k="Fiabilidade"
            v={`${vb.reliability}${vb.suspicious ? ' ⚠ suspeita' : ''} · ${vb.fair.sharps} sharp${vb.fair.sharps > 1 ? 's' : ''}`}
            cls={vb.suspicious || vb.reliability === 'baixa' ? 'neg' : vb.reliability === 'alta' ? 'pos' : 'neu'}
          />
          <DetRow k="Prob. justa (sharp)" v={prob(vb.fair.prob)} />
          <DetRow k="Odd justa" v={fmtOdd(vb.fair.fairOdd)} />
          {vb.books.map((b) => (
            <DetRow
              key={b.book}
              k={`${BOOK_META[b.book].label} ${b.book === vb.bestBook ? '★' : ''}`}
              v={`${fmtOdd(b.odd)} · ${signedPct(b.edge)}`}
              cls={b.edge > 0 ? 'pos' : 'neg'}
            />
          ))}
          <DetRow k="Stake Kelly sugerido" v={eur(vb.stake)} cls="pos" />
        </div>

        <div>
          <div className="detail-title">A minha análise</div>
          <textarea
            className="analysis-note"
            placeholder="A tua leitura do jogo: lesões, motivação, forma, porque tem valor…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
          />
        </div>
      </div>

      <div className="detail-actions">
        <a
          className="btn"
          href={vb.books.find((b) => b.book === vb.bestBook)?.deepLink ?? '#'}
          target="_blank"
          rel="noreferrer"
        >
          Abrir boletim {BOOK_META[vb.bestBook].label} ↗
        </a>
        <button className="btn primary" onClick={() => placeBet(vb)}>
          Registar aposta
        </button>
      </div>
    </div>
  );
}

function DetRow({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="calc-row">
      <span className="lbl">{k}</span>
      <span className={`val mono ${cls ?? ''}`}>{v}</span>
    </div>
  );
}
