/**
 * Modelo Poisson / Dixon-Coles (Fase 3).
 * Deriva odds justas de 1X2, ambas marcam e over/under a partir dos golos
 * esperados (λ casa, μ fora, ρ DC), e um mercado de contagem genérico para
 * cantos/cartões/remates onde a sharp cobre mal.
 */
import { useMemo, useState } from 'react';
import {
  dixonColesMatrix,
  matchProbabilities,
  totalGoalsOverUnder,
  countOverUnder,
  probToOdd,
} from '../lib/math/poisson';
import { odd as fmtOdd, pct } from '../lib/format';

export function Model() {
  const [lh, setLh] = useState(1.6);
  const [la, setLa] = useState(1.1);
  const [rho, setRho] = useState(-0.1);
  const [line, setLine] = useState(2.5);

  const sm = useMemo(() => dixonColesMatrix(lh, la, rho), [lh, la, rho]);
  const m = useMemo(() => matchProbabilities(sm), [sm]);
  const ou = useMemo(() => totalGoalsOverUnder(sm, line), [sm, line]);

  // contagem única (cantos/cartões)
  const [cLambda, setCLambda] = useState(10.2);
  const [cLine, setCLine] = useState(9.5);
  const cou = useMemo(() => countOverUnder(cLambda, cLine), [cLambda, cLine]);

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-h">Golos esperados (Dixon-Coles)</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Slider label={`λ casa (golos esperados) · ${lh.toFixed(2)}`} min={0.2} max={4} step={0.05} value={lh} onChange={setLh} />
          <Slider label={`μ fora (golos esperados) · ${la.toFixed(2)}`} min={0.2} max={4} step={0.05} value={la} onChange={setLa} />
          <Slider label={`ρ Dixon-Coles · ${rho.toFixed(2)}`} min={-0.2} max={0.2} step={0.01} value={rho} onChange={setRho} />
          <Row label="Linha over/under">
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={line}
              onChange={(e) => setLine(Number(e.target.value) || 0.5)}
              style={{ width: 90 }}
            />
          </Row>
          <div className="note">
            ρ negativo (típico ≈ −0.10) corrige a sub-estimação dos empates baixos da Poisson
            independente. λ/μ vêm do teu modelo (ataque×defesa, xG, etc.).
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">Odds justas derivadas</div>
        <div style={{ padding: 14 }}>
          <Section title="Resultado (1X2)" />
          <FairRow label="Casa" p={m.home} />
          <FairRow label="Empate" p={m.draw} />
          <FairRow label="Fora" p={m.away} />

          <Section title="Ambas marcam" />
          <FairRow label="Sim" p={m.bttsYes} />
          <FairRow label="Não" p={m.bttsNo} />

          <Section title={`Total de golos (linha ${line})`} />
          <FairRow label={`Mais de ${line}`} p={ou.over} />
          <FairRow label={`Menos de ${line}`} p={ou.under} />
          {ou.push > 0 && (
            <div className="calc-row">
              <span className="lbl muted">Push (resultado = linha)</span>
              <span className="val mono muted">{pct(ou.push, 1)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">Mercado de contagem (cantos / cartões / remates)</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Esperado (λ)">
            <input
              type="number"
              min={0}
              step={0.1}
              value={cLambda}
              onChange={(e) => setCLambda(Number(e.target.value) || 0)}
              style={{ width: 100 }}
            />
          </Row>
          <Row label="Linha">
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={cLine}
              onChange={(e) => setCLine(Number(e.target.value) || 0.5)}
              style={{ width: 100 }}
            />
          </Row>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">Over/Under da contagem</div>
        <div style={{ padding: 14 }}>
          <FairRow label={`Mais de ${cLine}`} p={cou.over} />
          <FairRow label={`Menos de ${cLine}`} p={cou.under} />
          {cou.push > 0 && (
            <div className="calc-row">
              <span className="lbl muted">Push</span>
              <span className="val mono muted">{pct(cou.push, 1)}</span>
            </div>
          )}
          <div className="note">
            Modelo Poisson simples para totais de contagem. Compara a odd justa com a da casa: se a
            casa pagar acima → +EV nesse nicho.
          </div>
        </div>
      </div>
    </div>
  );
}

function FairRow({ label, p }: { label: string; p: number }) {
  return (
    <div className="calc-row">
      <span className="lbl">{label}</span>
      <span className="val mono">
        <span className="muted" style={{ marginRight: 10 }}>{pct(p, 1)}</span>
        <span className="pos">{fmtOdd(probToOdd(p))}</span>
      </span>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <div className="section-title" style={{ margin: '14px 0 4px' }}>{title}</div>;
}

function Slider({
  label, min, max, step, value, onChange,
}: { label: string; min: number; max: number; step: number; value: number; onChange: (n: number) => void }) {
  return (
    <div className="field" style={{ gap: 6 }}>
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      {children}
    </div>
  );
}
