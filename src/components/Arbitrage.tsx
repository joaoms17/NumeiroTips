/**
 * Scanner de arbitragem (Fase 3).
 * Mostra mercados onde se pode cobrir todos os resultados em Betclic/1xBet/
 * Betfair com lucro garantido. Calcula os stakes para um total escolhido.
 */
import { useState } from 'react';
import { useStore } from '../state/store';
import type { ArbOpportunity } from '../engine/arbitrage';
import { eur, marketLabel, odd as fmtOdd, shortTime, signedPct, pct } from '../lib/format';

const BOOK_LABEL: Record<string, string> = {
  betclic: 'Betclic',
  '1xbet': '1xBet',
  betfair: 'Betfair',
  pinnacle: 'Pinnacle',
};

export function Arbitrage() {
  const arbs = useStore((s) => s.arbs);
  const [total, setTotal] = useState(100);

  return (
    <div>
      <div className="filters">
        <div className="field">
          <label htmlFor="arb-total">Total a distribuir (€)</label>
          <input
            id="arb-total"
            type="number"
            min={1}
            step={10}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value) || 0)}
            style={{ width: 120 }}
          />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <label>&nbsp;</label>
          <span className="status-pill mono">{arbs.length} arb</span>
        </div>
      </div>

      {arbs.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">
            <div style={{ fontSize: 28, marginBottom: 8 }}>⇄</div>
            Sem buracos no mercado agora.
            <br />
            <span className="muted">
              Buracos (surebets) entre Betclic e 1xBet são raros e fecham depressa — o scanner está
              a varrer continuamente.
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {arbs.map((a) => (
            <ArbCard key={a.id} arb={a} total={total} />
          ))}
        </div>
      )}

      <div className="note">
        Arbitragem = lucro garantido independentemente do resultado, mas atenção ao{' '}
        <strong>risco de conta</strong>: cobrir os dois lados é um padrão clássico de quem é
        limitado. Mantém stakes discretos, sobretudo na 1xBet (zona cinzenta). A app nunca aposta
        sozinha.
      </div>
    </div>
  );
}

function ArbCard({ arb, total }: { arb: ArbOpportunity; total: number }) {
  const ret = total / arb.bookSum;
  const profit = ret - total;
  return (
    <div className="panel">
      <div className="panel-h" style={{ justifyContent: 'space-between' }}>
        <span>
          <span className="market-chip">{marketLabel(arb.market)}</span>
          {arb.event.home} <span className="dim">v</span> {arb.event.away}
          <span className="muted" style={{ marginLeft: 8 }}>
            {arb.event.league} · {shortTime(arb.event.startsAt)}
          </span>
        </span>
        <span className="pos mono" title="margem garantida">
          {signedPct(arb.margin)}
        </span>
      </div>
      <div className="table-wrap" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th className="l">Apostar em</th>
              <th>Casa</th>
              <th>Odd</th>
              <th>Stake</th>
              <th>Retorno</th>
            </tr>
          </thead>
          <tbody>
            {arb.legs.map((leg) => {
              const stake = leg.stakeFraction * total;
              return (
                <tr key={leg.selectionId}>
                  <td className="l sel-cell">{leg.label}</td>
                  <td>
                    <span className="mono">{BOOK_LABEL[leg.book] ?? leg.book}</span>
                  </td>
                  <td className="mono">{fmtOdd(leg.odd)}</td>
                  <td className="mono">{eur(stake)}</td>
                  <td className="mono">{eur(stake * leg.odd)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="calc-row" style={{ padding: '8px 14px' }}>
        <span className="lbl">
          Total {eur(total)} · book sum <span className="mono">{arb.bookSum.toFixed(4)}</span> ·
          retorno garantido <span className="pos mono">{eur(ret)}</span>
        </span>
        <span className="val pos mono">
          lucro {eur(profit)} ({pct(arb.margin, 2)})
        </span>
      </div>
    </div>
  );
}
