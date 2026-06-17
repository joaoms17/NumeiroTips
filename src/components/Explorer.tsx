/**
 * Explorador — escolhe competição e jogo e analisa estatísticas para decidir:
 * por blocos de 15 min (remates/xG/cantos/golos), posse, posse vs cantos, e
 * eficácia (xG vs golos). Dados HISTÓRICOS do StatsBomb (Mundial 2022 + Euro 2024).
 */
import { useMemo, useState } from 'react';
import {
  competitions,
  matchesOf,
  getMatch,
  xgDelta,
  BUCKET_LABELS,
  matchData,
  type TeamMatchStat,
} from '../lib/matches';
import { BarTimeline } from './charts/BarTimeline';

type Metric = 'shots' | 'xg' | 'corners' | 'goals';
const METRICS: Array<{ k: Metric; label: string }> = [
  { k: 'shots', label: 'Remates' },
  { k: 'xg', label: 'xG' },
  { k: 'corners', label: 'Cantos' },
  { k: 'goals', label: 'Golos' },
];

export function Explorer() {
  const comps = competitions();
  const [comp, setComp] = useState(comps[0] ?? '');
  const list = useMemo(() => matchesOf(comp), [comp]);
  const [matchId, setMatchId] = useState<number | null>(list[0]?.id ?? null);
  const [metric, setMetric] = useState<Metric>('shots');

  const effList = list;
  const effId = effList.find((x) => x.id === matchId) ? matchId : effList[0]?.id ?? null;
  const m = effId != null ? getMatch(effId) : undefined;

  return (
    <div>
      <div className="filters">
        <div className="field">
          <label>Competição</label>
          <select
            value={comp}
            onChange={(e) => {
              setComp(e.target.value);
              setMatchId(matchesOf(e.target.value)[0]?.id ?? null);
            }}
          >
            {comps.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label>Jogo</label>
          <select value={effId ?? ''} onChange={(e) => setMatchId(Number(e.target.value))}>
            {effList.map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
        </div>
      </div>

      {!m ? (
        <div className="empty">Escolhe um jogo.</div>
      ) : (
        <MatchDashboard m={m} metric={metric} setMetric={setMetric} />
      )}

      <div className="note">
        Dados de eventos reais do {matchData.source} (Mundial 2022 + Euro 2024). É histórico — serve
        para perceberes padrões (ex.: quem domina os últimos 15 min, quem cria mais xG do que marca,
        posse que se converte em cantos) e transportares essa leitura para os mercados.
      </div>
    </div>
  );
}

function MatchDashboard({
  m,
  metric,
  setMetric,
}: {
  m: ReturnType<typeof getMatch> & object;
  metric: Metric;
  setMetric: (x: Metric) => void;
}) {
  const [home, away] = m.teams;
  return (
    <div>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-h" style={{ justifyContent: 'space-between' }}>
          <span>{m.comp} · {m.stage} · {m.date}</span>
        </div>
        <div style={{ padding: 14, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
            {m.home} <span className="pos">{m.hs}</span> — <span className="pos">{m.as}</span> {m.away}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <TeamStatCard t={home} accent="var(--green)" />
        <TeamStatCard t={away} accent="var(--cyan)" />
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-h" style={{ justifyContent: 'space-between' }}>
          <span>Por bloco de 15 min — <span className="pos">{m.home}</span> vs <span style={{ color: 'var(--cyan)' }}>{m.away}</span></span>
          <span style={{ display: 'flex', gap: 4 }}>
            {METRICS.map((mt) => (
              <button
                key={mt.k}
                className={`btn ${metric === mt.k ? 'primary' : 'ghost'}`}
                style={{ padding: '3px 8px', fontSize: 12 }}
                onClick={() => setMetric(mt.k)}
              >
                {mt.label}
              </button>
            ))}
          </span>
        </div>
        <div style={{ padding: 12 }}>
          <BarTimeline labels={BUCKET_LABELS} home={home.b[metric]} away={away.b[metric]} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="panel">
          <div className="panel-h">Posse vs cantos</div>
          <div style={{ padding: 14 }}>
            <PossCorners t={home} />
            <PossCorners t={away} />
            <div className="note" style={{ marginTop: 8 }}>
              Muita posse que <em>não</em> gera cantos/remates costuma ser posse estéril — sinal para
              under de cantos dessa equipa.
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h">Eficácia (xG vs golos)</div>
          <div style={{ padding: 14 }}>
            <Effic t={home} />
            <Effic t={away} />
            <div className="note" style={{ marginTop: 8 }}>
              Marcar muito acima do xG é difícil de manter (regressão à média); abaixo do xG sugere
              azar/finalização — útil para apostas de valor no jogo seguinte.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamStatCard({ t, accent }: { t: TeamMatchStat; accent: string }) {
  return (
    <div className="panel">
      <div className="panel-h" style={{ color: accent }}>{t.name}</div>
      <div className="grid-3" style={{ gap: 8, padding: 12 }}>
        <Mini k="Posse" v={`${t.poss}%`} />
        <Mini k="Remates" v={String(t.shots)} />
        <Mini k="xG" v={t.xg.toFixed(2)} />
        <Mini k="Cantos" v={String(t.corners)} />
        <Mini k="Golos" v={String(t.goals)} />
        <Mini k="Passes" v={String(t.passes)} />
      </div>
    </div>
  );
}

function PossCorners({ t }: { t: TeamMatchStat }) {
  return (
    <div className="calc-row">
      <span className="lbl">{t.name}</span>
      <span className="val mono">
        <span className="muted">{t.poss}% posse</span> · <span>{t.corners} cantos</span>
      </span>
    </div>
  );
}

function Effic({ t }: { t: TeamMatchStat }) {
  const d = xgDelta(t);
  return (
    <div className="calc-row">
      <span className="lbl">{t.name}</span>
      <span className="val mono">
        xG {t.xg.toFixed(2)} · golos {t.goals} ·{' '}
        <span className={d > 0.3 ? 'neg' : d < -0.3 ? 'pos' : 'neu'}>
          {d > 0 ? `+${d}` : d} {d > 0.3 ? '(azar)' : d < -0.3 ? '(eficaz)' : ''}
        </span>
      </span>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat" style={{ padding: 8 }}>
      <div className="k">{k}</div>
      <div className="v mono" style={{ fontSize: 16 }}>{v}</div>
    </div>
  );
}
