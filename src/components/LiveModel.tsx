/**
 * Ao Vivo — análise de situações em jogo (in-play).
 * Ajusta as expectativas de golos ao minuto/resultado/expulsões e mostra as
 * probabilidades para o resto do jogo: 1X2, ambas marcam, over/under e próximo
 * golo. Captura "como as equipas reagem" via parâmetros de reação ajustáveis.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  liveProbabilities,
  remainingRates,
  liveTotals,
  DEFAULT_INPLAY_PARAMS,
  type GameState,
} from '../lib/math/inplay';
import { dixonColesMatrix } from '../lib/math/poisson';
import { useStore } from '../state/store';
import { odd as fmtOdd, pct } from '../lib/format';

export function LiveModel() {
  const seed = useStore((s) => s.inplaySeed);
  const [lambda, setLambda] = useState(seed?.lambda ?? 1.6);
  const [mu, setMu] = useState(seed?.mu ?? 1.2);

  // Quando vem um confronto dos Padrões, carrega os golos esperados.
  useEffect(() => {
    if (seed) {
      setLambda(seed.lambda);
      setMu(seed.mu);
    }
  }, [seed]);
  const [minute, setMinute] = useState(60);
  const [hg, setHg] = useState(1);
  const [ag, setAg] = useState(0);
  const [hr, setHr] = useState(0);
  const [ar, setAr] = useState(0);
  const [line, setLine] = useState(2.5);

  const state: GameState = { minute, homeGoals: hg, awayGoals: ag, homeReds: hr, awayReds: ar };

  const live = useMemo(() => liveProbabilities(lambda, mu, state), [lambda, mu, minute, hg, ag, hr, ar]);
  const totals = useMemo(() => {
    const r = remainingRates(lambda, mu, state);
    const sm = dixonColesMatrix(r.lambdaRem, r.muRem, DEFAULT_INPLAY_PARAMS.rho, 8);
    return liveTotals(sm, state, line);
  }, [lambda, mu, minute, hg, ag, hr, ar, line]);

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-h">Situação de jogo</div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-2" style={{ gap: 10 }}>
            <NumField label="λ casa (pré-jogo)" value={lambda} step={0.05} min={0.2} onChange={setLambda} />
            <NumField label="μ fora (pré-jogo)" value={mu} step={0.05} min={0.2} onChange={setMu} />
          </div>
          <Slider label={`Minuto · ${minute}'`} min={0} max={90} step={1} value={minute} onChange={setMinute} />
          <div className="grid-2" style={{ gap: 10 }}>
            <NumField label="Golos casa" value={hg} step={1} min={0} onChange={(v) => setHg(Math.round(v))} />
            <NumField label="Golos fora" value={ag} step={1} min={0} onChange={(v) => setAg(Math.round(v))} />
          </div>
          <div className="grid-2" style={{ gap: 10 }}>
            <NumField label="Vermelhos casa" value={hr} step={1} min={0} onChange={(v) => setHr(Math.round(v))} />
            <NumField label="Vermelhos fora" value={ar} step={1} min={0} onChange={(v) => setAr(Math.round(v))} />
          </div>
          <NumField label="Linha over/under (total)" value={line} step={0.5} min={0.5} onChange={setLine} />

          <div className="calc-row">
            <span className="lbl muted">Golos esperados no resto do jogo</span>
            <span className="val mono">
              casa {live.rates.lambdaRem.toFixed(2)} · fora {live.rates.muRem.toFixed(2)}
            </span>
          </div>
          <div className="note">
            O modelo escala as taxas pelo tempo que falta e ajusta-as à situação: quem perde ataca
            mais (mais ainda perto do fim), quem ganha gere, e expulsões reduzem a equipa em
            inferioridade. Parâmetros editáveis em `inplay.ts`.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">Probabilidades ao vivo (resto do jogo)</div>
        <div style={{ padding: 14 }}>
          <div className="section-title" style={{ margin: '2px 0 4px' }}>
            Resultado final (1X2)
          </div>
          <FairRow label="Casa" p={live.home} />
          <FairRow label="Empate" p={live.draw} />
          <FairRow label="Fora" p={live.away} />

          <div className="section-title" style={{ margin: '14px 0 4px' }}>
            Próximo golo
          </div>
          <FairRow label="Casa marca a seguir" p={live.nextGoalHome} />
          <FairRow label="Fora marca a seguir" p={live.nextGoalAway} />
          <FairRow label="Sem mais golos" p={live.nextGoalNone} />

          <div className="section-title" style={{ margin: '14px 0 4px' }}>
            Ambas marcam (jogo todo)
          </div>
          <FairRow label="Sim" p={live.bttsYes} />
          <FairRow label="Não" p={live.bttsNo} />

          <div className="section-title" style={{ margin: '14px 0 4px' }}>
            Total de golos (linha {line})
          </div>
          <FairRow label={`Mais de ${line}`} p={totals.over} />
          <FairRow label={`Menos de ${line}`} p={totals.under} />
          {totals.push > 0 && (
            <div className="calc-row">
              <span className="lbl muted">Push</span>
              <span className="val mono muted">{pct(totals.push, 1)}</span>
            </div>
          )}
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
        <span className="pos">{p > 0.0001 ? fmtOdd(1 / p) : '—'}</span>
      </span>
    </div>
  );
}

function NumField({
  label, value, step, min, onChange,
}: { label: string; value: number; step: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="field" style={{ gap: 4 }}>
      <label>{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
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
