/**
 * Painel — cockpit pessoal: métricas-chave, curva de P/L e banca, CLV,
 * estado do feed ao vivo e backup dos dados.
 */
import { useMemo, useRef } from 'react';
import { useStore, selectFilteredFeed } from '../state/store';
import { computeAnalytics } from '../state/analytics';
import { Sparkline } from './charts/Sparkline';
import { downloadBackup, parseBackup } from '../lib/backup';
import { eur, signedPct, pct } from '../lib/format';

export function Dashboard() {
  const bets = useStore((s) => s.bets);
  const config = useStore((s) => s.config);
  const importState = useStore((s) => s.importState);
  const valueBets = useStore((s) => s.valueBets);
  const arbs = useStore((s) => s.arbs);
  const feedCount = useStore(selectFilteredFeed).length;
  const fileRef = useRef<HTMLInputElement>(null);

  const a = useMemo(() => computeAnalytics(bets, config.bankroll), [bets, config.bankroll]);
  const bestEdge = valueBets.length ? valueBets[0].bestEdge : 0;

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBackup(String(reader.result));
        importState(parsed);
        alert('Backup importado com sucesso.');
      } catch (e) {
        alert(`Importação falhou: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      {/* métricas-chave */}
      <div className="grid-3">
        <Stat k="Banca" v={eur(config.bankroll)} />
        <Stat k="P/L liquidado" v={eur(a.totalPnl)} cls={a.totalPnl >= 0 ? 'pos' : 'neg'} />
        <Stat k="ROI" v={signedPct(a.roi, 1)} cls={a.roi >= 0 ? 'pos' : 'neg'} />
        <Stat k="CLV médio" v={signedPct(a.avgClv, 2)} cls={a.avgClv >= 0 ? 'pos' : 'neg'} />
        <Stat k="Bateu o fecho" v={pct(a.clvBeatRate, 0)} cls={a.clvBeatRate >= 0.5 ? 'pos' : 'neu'} />
        <Stat k="Taxa de acerto" v={pct(a.winRate, 0)} />
      </div>

      {/* gráficos */}
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="panel">
          <div className="panel-h">P/L acumulado · {a.settledCount} apostas</div>
          <div style={{ padding: 12 }}>
            <Sparkline values={a.pnlSeries.map((p) => p.cumPnl)} baseline={0} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-h">Curva da banca</div>
          <div style={{ padding: 12 }}>
            <Sparkline values={a.bankrollSeries} baseline={config.bankroll} color="var(--cyan)" />
          </div>
        </div>
      </div>

      {/* agora */}
      <div className="section-title">Agora</div>
      <div className="grid-3">
        <Stat k="Value bets (filtro)" v={String(feedCount)} cls={feedCount > 0 ? 'pos' : 'muted'} />
        <Stat k="Melhor edge" v={bestEdge > 0 ? signedPct(bestEdge) : '—'} cls={bestEdge > 0 ? 'pos' : 'muted'} />
        <Stat k="Arbitragens" v={String(arbs.length)} cls={arbs.length > 0 ? 'pos' : 'muted'} />
      </div>

      {/* extremos */}
      <div className="grid-3" style={{ marginTop: 12 }}>
        <Stat k="Pendentes" v={String(a.pendingCount)} cls="neu" />
        <Stat k="Maior ganho" v={eur(a.biggestWin)} cls="pos" />
        <Stat k="Maior perda" v={eur(a.biggestLoss)} cls="neg" />
      </div>

      {/* backup */}
      <div className="section-title">Dados</div>
      <div className="panel">
        <div style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn" onClick={() => downloadBackup(config, bets)}>
            ⬇ Exportar backup (JSON)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Importar backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            Os dados vivem só neste browser. Exporta de vez em quando para não perderes o histórico.
          </span>
        </div>
      </div>

      <div className="note">
        O <strong>CLV médio</strong> e o <strong>% que bate o fecho</strong> são os melhores
        indicadores de skill a longo prazo — mais fiáveis que o P/L de curto prazo, que tem muita
        variância. Foca-te em apostar consistentemente acima da linha de fecho.
      </div>
    </div>
  );
}

function Stat({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className={`v ${cls ?? ''}`}>{v}</div>
    </div>
  );
}
