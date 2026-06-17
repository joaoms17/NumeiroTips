/**
 * Padrões — análise data-driven a partir de perfis reais (StatsBomb).
 * Escolhe um confronto → golos esperados (modelo de força) e odds justas
 * pré-jogo; vê equipas semelhantes por perfil; manda o confronto para o Ao Vivo.
 */
import { useMemo, useState } from 'react';
import {
  allTeams,
  getProfile,
  matchupExpectedGoals,
  matchupCounts,
  similarTeams,
  profiles,
} from '../lib/patterns';
import {
  dixonColesMatrix,
  matchProbabilities,
  totalGoalsOverUnder,
  countOverUnder,
} from '../lib/math/poisson';
import { teamTrends, type TeamTrends } from '../lib/trends';
import { useStore } from '../state/store';
import { odd as fmtOdd, pct } from '../lib/format';

export function Patterns() {
  const teams = allTeams();
  const setInplaySeed = useStore((s) => s.setInplaySeed);
  const [home, setHome] = useState(teams[0]?.team ?? '');
  const [away, setAway] = useState(teams[1]?.team ?? '');
  const [homeAdv, setHomeAdv] = useState(1.0);
  const [line, setLine] = useState(2.5);

  const exp = useMemo(() => matchupExpectedGoals(home, away, homeAdv), [home, away, homeAdv]);
  const proj = useMemo(() => {
    if (!exp) return null;
    const sm = dixonColesMatrix(exp.lambda, exp.mu, -0.1);
    return { m: matchProbabilities(sm), ou: totalGoalsOverUnder(sm, line) };
  }, [exp, line]);

  const counts = useMemo(() => matchupCounts(home, away), [home, away]);
  const [cornerLine, setCornerLine] = useState(9.5);
  const [shotLine, setShotLine] = useState(24.5);
  const [scorerShare, setScorerShare] = useState(0.3);

  const cornersOU = counts ? countOverUnder(counts.corners, cornerLine) : null;
  const shotsOU = counts ? countOverUnder(counts.shots, shotLine) : null;
  // marcador (casa): golos esperados do jogador = golos esperados da equipa × quota
  const teamGoalsHome = exp?.lambda ?? 0;
  const playerXg = teamGoalsHome * scorerShare;
  const anytime = 1 - Math.exp(-playerXg);
  const twoPlus = 1 - Math.exp(-playerXg) * (1 + playerXg);

  const simHome = useMemo(() => similarTeams(home, 5), [home]);
  const trendsHome = useMemo(() => teamTrends(home), [home]);
  const trendsAway = useMemo(() => teamTrends(away), [away]);
  const ph = getProfile(home);
  const pa = getProfile(away);

  return (
    <div>
      <div className="note ok" style={{ marginTop: 0 }}>
        Perfis de <strong>{profiles.teams.length} seleções</strong> a partir de dados reais (
        {profiles.competitions.map((c) => c.label).join(' + ')}, fonte: {profiles.source}). Amostra
        de torneio é pequena — ratings reais mas com ruído.
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-h">Confronto</div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="field">
                <label>Casa</label>
                <TeamSelect value={home} onChange={setHome} teams={teams.map((t) => t.team)} />
              </div>
              <div className="field">
                <label>Fora</label>
                <TeamSelect value={away} onChange={setAway} teams={teams.map((t) => t.team)} />
              </div>
            </div>
            <div className="field" style={{ gap: 6 }}>
              <label>Vantagem caseira · {homeAdv.toFixed(2)} (1.00 = neutro)</label>
              <input type="range" min={1} max={1.3} step={0.02} value={homeAdv} onChange={(e) => setHomeAdv(Number(e.target.value))} />
            </div>

            {ph && pa && (
              <div className="grid-2" style={{ gap: 10 }}>
                <ProfileCard label={home} attack={ph.attack} defense={ph.defense} gfpg={ph.gfpg} gapg={ph.gapg} />
                <ProfileCard label={away} attack={pa.attack} defense={pa.defense} gfpg={pa.gfpg} gapg={pa.gapg} />
              </div>
            )}

            {exp && (
              <div className="calc-row">
                <span className="lbl">Golos esperados (modelo de força)</span>
                <span className="val mono">
                  {home} {exp.lambda.toFixed(2)} · {away} {exp.mu.toFixed(2)}
                </span>
              </div>
            )}
            <button
              className="btn primary"
              disabled={!exp}
              onClick={() => exp && setInplaySeed({ ...exp, home, away })}
              title="Carrega estes golos esperados no separador Ao Vivo"
            >
              → Analisar em jogo (Ao Vivo)
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">Odds justas pré-jogo</div>
          <div style={{ padding: 14 }}>
            <div className="field" style={{ gap: 6, marginBottom: 8 }}>
              <label>Linha over/under</label>
              <input type="number" min={0.5} step={0.5} value={line} onChange={(e) => setLine(Number(e.target.value) || 0.5)} style={{ width: 90 }} />
            </div>
            {proj ? (
              <>
                <div className="section-title" style={{ margin: '2px 0 4px' }}>Resultado (1X2)</div>
                <FairRow label={home} p={proj.m.home} />
                <FairRow label="Empate" p={proj.m.draw} />
                <FairRow label={away} p={proj.m.away} />
                <div className="section-title" style={{ margin: '12px 0 4px' }}>Golos</div>
                <FairRow label={`Mais de ${line}`} p={proj.ou.over} />
                <FairRow label={`Menos de ${line}`} p={proj.ou.under} />
                <FairRow label="Ambas marcam" p={proj.m.bttsYes} />
              </>
            ) : (
              <span className="muted">Escolhe um confronto válido.</span>
            )}
          </div>
        </div>
      </div>

      <div className="section-title">Tendências históricas (forma + mercados)</div>
      <div className="grid-2">
        <TrendsCard t={trendsHome} />
        <TrendsCard t={trendsAway} />
      </div>

      <div className="section-title">Mercados de nicho (modelo · sem odds da casa)</div>
      <div className="grid-3">
        <div className="panel">
          <div className="panel-h">Cantos</div>
          <div style={{ padding: 12 }}>
            <div className="calc-row">
              <span className="lbl">Esperados (total)</span>
              <span className="val mono">{counts ? counts.corners.toFixed(1) : '—'}</span>
            </div>
            <div className="field" style={{ gap: 6, margin: '8px 0' }}>
              <label>Linha · {cornerLine}</label>
              <input type="number" min={0.5} step={0.5} value={cornerLine} onChange={(e) => setCornerLine(Number(e.target.value) || 0.5)} style={{ width: 90 }} />
            </div>
            {cornersOU && (
              <>
                <FairRow label={`Mais de ${cornerLine}`} p={cornersOU.over} />
                <FairRow label={`Menos de ${cornerLine}`} p={cornersOU.under} />
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">Remates</div>
          <div style={{ padding: 12 }}>
            <div className="calc-row">
              <span className="lbl">Esperados (total)</span>
              <span className="val mono">{counts ? counts.shots.toFixed(1) : '—'}</span>
            </div>
            <div className="field" style={{ gap: 6, margin: '8px 0' }}>
              <label>Linha · {shotLine}</label>
              <input type="number" min={0.5} step={0.5} value={shotLine} onChange={(e) => setShotLine(Number(e.target.value) || 0.5)} style={{ width: 90 }} />
            </div>
            {shotsOU && (
              <>
                <FairRow label={`Mais de ${shotLine}`} p={shotsOU.over} />
                <FairRow label={`Menos de ${shotLine}`} p={shotsOU.under} />
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">Marcador ({home})</div>
          <div style={{ padding: 12 }}>
            <div className="field" style={{ gap: 6, marginBottom: 8 }}>
              <label>Quota do jogador no ataque · {pct(scorerShare, 0)}</label>
              <input type="range" min={0.05} max={0.6} step={0.05} value={scorerShare} onChange={(e) => setScorerShare(Number(e.target.value))} />
            </div>
            <div className="calc-row">
              <span className="lbl muted">Golos esperados do jogador</span>
              <span className="val mono">{playerXg.toFixed(2)}</span>
            </div>
            <FairRow label="Marca a qualquer momento" p={anytime} />
            <FairRow label="Marca 2+" p={twoPlus} />
          </div>
        </div>
      </div>
      <div className="note">
        Contagens esperadas pelo mesmo modelo de força (taxa a favor × taxa contra ÷ média), a
        partir de remates/xG/cantos reais do StatsBomb. São <strong>estimativas</strong> para
        comparares com a odd da casa — não há odds destes mercados na fonte grátis.
      </div>

      <div className="section-title">Equipas semelhantes a {home}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="l">Equipa</th>
              <th>Ataque</th>
              <th>Defesa</th>
              <th>Distância</th>
            </tr>
          </thead>
          <tbody>
            {simHome.map((s) => (
              <tr key={s.team}>
                <td className="l sel-cell">{s.team}</td>
                <td className="mono">{s.attack.toFixed(2)}</td>
                <td className="mono">{s.defense.toFixed(2)}</td>
                <td className="mono muted">{s.distance.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note">
        "Semelhante" = perfil ataque×defesa próximo. Serve para raciocinar por analogia: como o
        {' '}{away} se costuma portar contra equipas parecidas com o {home}. Para padrões por
        situação de jogo (a perder/a ganhar) seria preciso processar dados de eventos — ver README.
      </div>
    </div>
  );
}

function TeamSelect({ value, onChange, teams }: { value: string; onChange: (v: string) => void; teams: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {teams.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

function ProfileCard({ label, attack, defense, gfpg, gapg }: { label: string; attack: number; defense: number; gfpg: number; gapg: number }) {
  return (
    <div className="stat" style={{ padding: 10 }}>
      <div className="k">{label}</div>
      <div className="mono" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
        <span className={attack >= 1 ? 'pos' : 'muted'}>atq {attack.toFixed(2)}</span> ·{' '}
        <span className={defense <= 1 ? 'pos' : 'neg'}>def {defense.toFixed(2)}</span>
        <br />
        <span className="muted">{gfpg.toFixed(2)} marcados · {gapg.toFixed(2)} sofridos / jogo</span>
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

function TrendsCard({ t }: { t: TeamTrends | null }) {
  if (!t) {
    return (
      <div className="panel">
        <div className="panel-h">Tendências</div>
        <div style={{ padding: 14 }} className="muted">Sem histórico para esta equipa.</div>
      </div>
    );
  }
  return (
    <div className="panel">
      <div className="panel-h" style={{ justifyContent: 'space-between' }}>
        <span>{t.team}</span>
        <span style={{ display: 'flex', gap: 3 }}>
          {t.form.map((r, i) => (
            <span key={i} className={`form-dot ${r === 'W' ? 'pos' : r === 'L' ? 'neg' : 'neu'}`}>{r}</span>
          ))}
        </span>
      </div>
      <div style={{ padding: 12 }}>
        <TrendRow k="Jogos" v={String(t.played)} />
        <TrendRow k="Média golos (marca/sofre)" v={`${t.gfAvg} / ${t.gaAvg}`} />
        <TrendRow k="Over 2.5" v={pct(t.over25, 0)} hi={t.over25 >= 0.5} />
        <TrendRow k="Ambas marcam" v={pct(t.bttsPct, 0)} hi={t.bttsPct >= 0.5} />
        <TrendRow k="Clean sheet" v={pct(t.cleanSheetPct, 0)} />
        <TrendRow k="Cantos (própria / total)" v={`${t.cornersForAvg} / ${t.cornersTotalAvg}`} />
        <TrendRow k="Cartões (própria / total)" v={`${t.cardsForAvg} / ${t.cardsTotalAvg}`} />
      </div>
    </div>
  );
}

function TrendRow({ k, v, hi }: { k: string; v: string; hi?: boolean }) {
  return (
    <div className="calc-row">
      <span className="lbl">{k}</span>
      <span className={`val mono ${hi ? 'pos' : ''}`}>{v}</span>
    </div>
  );
}
