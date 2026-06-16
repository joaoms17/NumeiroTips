/**
 * Tracker de exposição por casa + alertas de risco e jogo responsável.
 */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import { computeExposure, DEFAULT_EXPOSURE_LIMITS } from '../state/exposure';
import { eur } from '../lib/format';

export function Exposure() {
  const bets = useStore((s) => s.bets);
  const limits = DEFAULT_EXPOSURE_LIMITS;
  const exposures = useMemo(() => computeExposure(bets, limits), [bets, limits]);

  return (
    <div>
      <div className="grid-2">
        {exposures.map((e) => {
          const ratio = Math.min(1, e.pending / limits.maxPending);
          const barCls = ratio >= 1 ? 'over' : ratio >= 0.7 ? 'warn' : '';
          return (
            <div key={e.book} className={`exposure-card ${e.atRisk ? 'at-risk' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 16 }}>{e.label}</strong>
                <span className={`risk-tag ${e.risk}`}>
                  {e.risk === 'licenciada' ? 'SRIJ · licenciada' : 'zona cinzenta'}
                </span>
              </div>

              <div className="grid-2" style={{ marginTop: 12, gap: 8 }}>
                <div className="stat" style={{ padding: 10 }}>
                  <div className="k">Pendente (em risco)</div>
                  <div className="v mono" style={{ fontSize: 18 }}>
                    {eur(e.pending)}
                  </div>
                </div>
                <div className="stat" style={{ padding: 10 }}>
                  <div className="k">Saldo retido (P/L)</div>
                  <div
                    className={`v mono ${e.settledPnl >= 0 ? 'pos' : 'neg'}`}
                    style={{ fontSize: 18 }}
                  >
                    {eur(e.settledPnl)}
                  </div>
                </div>
              </div>

              <div className="bar" title={`${e.pending}€ de ${limits.maxPending}€`}>
                <span className={barCls} style={{ width: `${ratio * 100}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                {e.pendingCount} pendente(s) · limite {eur(limits.maxPending)}
              </div>

              {e.atRisk && <div className="note danger">⚠ {e.reason}</div>}
              {!e.atRisk && e.risk === 'cinzenta' && (
                <div className="note">
                  1xBet não é licenciada pela SRIJ. Não acumules saldo: levanta com frequência.
                </div>
              )}
              {!e.atRisk && e.risk === 'licenciada' && (
                <div className="note ok">
                  Betclic limita vencedores consistentes. Mantém stakes discretos e arredondados.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="note">
        <strong>Jogo responsável.</strong> Esta é uma ferramenta de análise pessoal. Os edges são
        pequenos (1–5%) e a variância é real: desenha para muitas apostas pequenas, nunca tacadas
        grandes. Define limites de perda e de stake nas Definições. A app <b>nunca</b> coloca
        apostas automaticamente — a decisão é sempre tua.
      </div>
    </div>
  );
}
