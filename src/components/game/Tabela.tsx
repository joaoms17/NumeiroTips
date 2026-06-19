/** Classificação — soma de ratings, com barras animadas e coroa para o líder. */
import { useEffect, useState, type CSSProperties } from 'react';
import { useGame, standingsOf } from '../../game/store';

export function Tabela() {
  const meId = useGame((s) => s.meId);
  const rows = useGame(standingsOf);
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="rr-tabela">
      <div className="rr-tabela-h">
        <span>👑 Classificação</span>
        <span className="muted">soma de ratings</span>
      </div>

      {rows.map((r, i) => (
        <div
          key={r.friend.id}
          className={`rr-rank slide-up ${i === 0 ? 'leader' : ''} ${r.friend.id === meId ? 'me' : ''}`}
          style={{ '--c': r.friend.color, animationDelay: `${i * 90}ms` } as CSSProperties}
        >
          <span className="rr-rank-pos">{i === 0 ? '👑' : i + 1}</span>
          <span className="rr-rank-emoji">{r.friend.emoji}</span>
          <div className="rr-rank-body">
            <div className="rr-rank-top">
              <span className="rr-rank-name">{r.friend.name}</span>
              <span className="rr-rank-total"><CountUp value={r.total} /></span>
            </div>
            <div className="rr-bar">
              <span
                className="rr-bar-fill"
                style={{ width: `${(r.total / max) * 100}%`, background: r.friend.color }}
              />
            </div>
            <div className="rr-rank-sub muted">
              {r.picks} jogos · melhor {r.best.toFixed(1)}
            </div>
          </div>
        </div>
      ))}

      <div className="rr-tabela-foot muted">
        Soma-se o rating real de cada jogador escolhido. Atualiza sozinho quando os jogos acabam.
      </div>
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setN(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{n.toFixed(1)}</span>;
}
