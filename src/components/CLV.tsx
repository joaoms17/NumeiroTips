/**
 * CLV — closing line value. Para cada aposta registada (botão Apostar no feed),
 * a app capta a linha de fecho sharp (odd justa antes do início) e mede se
 * apostaste a uma odd melhor que o fecho. Bater o fecho é o melhor indicador
 * de skill a longo prazo.
 */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import { odd as fmtOdd, signedPct, pct, shortTime } from '../lib/format';

export function CLV() {
  const bets = useStore((s) => s.bets);
  const removeBet = useStore((s) => s.removeBet);

  const tracked = useMemo(
    () => bets.filter((b) => b.selectionId).sort((a, b) => b.placedAt.localeCompare(a.placedAt)),
    [bets],
  );

  const stats = useMemo(() => {
    const withClv = tracked.filter((b) => b.clv != null);
    const avg = withClv.length ? withClv.reduce((s, b) => s + (b.clv ?? 0), 0) / withClv.length : 0;
    const beat = withClv.length ? withClv.filter((b) => (b.clv ?? 0) > 0).length / withClv.length : 0;
    return { count: tracked.length, withClv: withClv.length, avg, beat };
  }, [tracked]);

  return (
    <div>
      <div className="grid-3">
        <Stat k="CLV médio" v={signedPct(stats.avg, 2)} cls={stats.avg >= 0 ? 'pos' : 'neg'} />
        <Stat k="Bateu o fecho" v={pct(stats.beat, 0)} cls={stats.beat >= 0.5 ? 'pos' : 'neu'} />
        <Stat k="Apostas seguidas" v={String(stats.count)} />
      </div>

      {tracked.length === 0 ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <div className="empty">
            Ainda não há apostas a seguir. Carrega em <b>Apostar</b> numa aposta do feed — a app
            capta a linha de fecho sharp automaticamente e calcula o CLV.
          </div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th className="l">Aposta</th>
                <th>Odd</th>
                <th>Justa (ao apostar)</th>
                <th>Fecho sharp</th>
                <th>CLV</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tracked.map((b) => {
                const started = b.startsAt ? new Date(b.startsAt).getTime() <= Date.now() : false;
                return (
                  <tr key={b.id}>
                    <td className="l sel-cell">{b.label}</td>
                    <td className="mono">{fmtOdd(b.odd)}</td>
                    <td className="mono neu">{fmtOdd(b.fairOddAtBet)}</td>
                    <td className="mono">{b.closingFairOdd != null ? fmtOdd(b.closingFairOdd) : '—'}</td>
                    <td className={`mono ${b.clv == null ? 'dim' : b.clv >= 0 ? 'pos' : 'neg'}`}>
                      {b.clv == null ? '—' : signedPct(b.clv)}
                    </td>
                    <td className="mono muted">
                      {started ? 'fechado' : 'pré-jogo'}
                      {b.startsAt && !started && (
                        <span className="dim"> · {shortTime(b.startsAt)}</span>
                      )}
                    </td>
                    <td>
                      <button className="btn ghost" onClick={() => removeBet(b.id)} title="Remover">
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="note">
        <strong>CLV = odd_apostada / odd_justa_de_fecho − 1.</strong> A linha de fecho é a odd justa
        sharp (Pinnacle+Betfair) no último instante antes do jogo começar — captada automaticamente
        enquanto a app está aberta. CLV médio positivo a longo prazo é o melhor sinal de que estás
        mesmo a apostar com valor.
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
