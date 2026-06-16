/**
 * Calculadora de Kelly fracionário (default ¼) + input de banca.
 * Mostra o passo-a-passo da fórmula para ser auditável.
 */
import { useMemo, useState } from 'react';
import { kelly, fullKellyFraction, discreetStake } from '../lib/math/kelly';
import { expectedValue } from '../lib/math/ev';
import { useStore } from '../state/store';
import { eur, pct, signedPct } from '../lib/format';

export function KellyCalculator() {
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);

  const [odd, setOdd] = useState(2.1);
  const [fairOdd, setFairOdd] = useState(2.0);
  const [fraction, setFraction] = useState(config.kellyFraction);

  const prob = fairOdd > 1 ? 1 / fairOdd : 0;
  const ev = expectedValue(prob, odd);
  const full = fullKellyFraction(prob, odd);

  const result = useMemo(
    () =>
      kelly({
        prob,
        odd,
        fraction,
        bankroll: config.bankroll,
        cap: config.stakeCap,
      }),
    [prob, odd, fraction, config.bankroll, config.stakeCap],
  );

  const discreet = result.stake != null ? discreetStake(result.stake, 0.5) : null;
  const b = odd - 1;
  const q = 1 - prob;

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-h">Entradas</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Banca (€)">
            <input
              type="number"
              min={0}
              step={10}
              value={config.bankroll}
              onChange={(e) => setConfig({ bankroll: Number(e.target.value) || 0 })}
              style={{ width: 120 }}
            />
          </Row>
          <Row label="Odd da casa">
            <input
              type="number"
              min={1.01}
              step={0.01}
              value={odd}
              onChange={(e) => setOdd(Number(e.target.value) || 1.01)}
              style={{ width: 120 }}
            />
          </Row>
          <Row label="Odd justa (sharp)">
            <input
              type="number"
              min={1.01}
              step={0.01}
              value={fairOdd}
              onChange={(e) => setFairOdd(Number(e.target.value) || 1.01)}
              style={{ width: 120 }}
            />
          </Row>
          <Row label={`Fração de Kelly · ${pct(fraction, 0)}`}>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={fraction}
              onChange={(e) => setFraction(Number(e.target.value))}
              style={{ width: 140 }}
            />
          </Row>
          <Row label={`Teto por aposta · ${pct(config.stakeCap, 0)} da banca`}>
            <input
              type="range"
              min={0.01}
              max={0.1}
              step={0.005}
              value={config.stakeCap}
              onChange={(e) => setConfig({ stakeCap: Number(e.target.value) })}
              style={{ width: 140 }}
            />
          </Row>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">Resultado</div>
        <div style={{ padding: 14 }}>
          <div className="calc-row">
            <span className="lbl">prob. justa p = 1/odd_justa</span>
            <span className="val mono">{pct(prob, 2)}</span>
          </div>
          <div className="calc-row">
            <span className="lbl">EV = p · odd − 1</span>
            <span className={`val mono ${ev > 0 ? 'pos' : ev < 0 ? 'neg' : 'neu'}`}>
              {signedPct(ev, 2)}
            </span>
          </div>
          <div className="calc-row">
            <span className="lbl">
              b = odd−1 = {b.toFixed(2)} · q = 1−p = {q.toFixed(3)}
            </span>
            <span className="val mono dim">f* = (b·p − q)/b</span>
          </div>
          <div className="calc-row">
            <span className="lbl">Kelly cheio f*</span>
            <span className="val mono">{pct(full, 2)}</span>
          </div>
          <div className="calc-row">
            <span className="lbl">Fração aplicada ({pct(fraction, 0)} + teto)</span>
            <span className="val mono">{pct(result.fraction, 2)}</span>
          </div>
          <div className="calc-row">
            <span className="lbl">Stake recomendado</span>
            <span className={`val mono ${result.positive ? 'pos' : 'neg'}`}>
              {eur(result.stake)}
            </span>
          </div>
          <div className="calc-row">
            <span className="lbl">Stake discreto (arredondado)</span>
            <span className="val mono pos">{eur(discreet)}</span>
          </div>

          {!result.positive && (
            <div className="note danger">
              EV ≤ 0 → fora de Kelly. Não apostar: a casa não está a pagar acima do justo.
            </div>
          )}
          {result.positive && result.fraction >= config.stakeCap && (
            <div className="note">
              Stake limitado pelo teto de {pct(config.stakeCap, 0)} da banca (segurança).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="muted" style={{ fontSize: 13 }}>
        {label}
      </span>
      {children}
    </div>
  );
}
