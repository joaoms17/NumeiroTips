/** Roda diária de ajudas — cartão + roleta animada. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGame, mySpin } from '../../game/store';
import { AJUDAS, ajudaMeta } from '../../game/wheel';
import type { AjudaId } from '../../game/types';

export function RodaBanner({ day }: { day: string }) {
  const rec = useGame((s) => mySpin(s, day));
  const [open, setOpen] = useState(false);

  let content: ReactNode;
  if (!rec) {
    content = (
      <button className="rr-spin-btn" onClick={() => setOpen(true)}>
        🎡 Rodar a roda do dia
      </button>
    );
  } else if (rec.ajuda === 'nenhuma') {
    content = <span className="rr-roda-txt">🚫 A roda não deu nada hoje.</span>;
  } else if (!rec.matchId) {
    const m = ajudaMeta(rec.ajuda);
    content = (
      <span className="rr-roda-txt">
        Tens <b>{m.emoji} {m.name}</b> — toca em <i>“usar”</i> num jogo.
      </span>
    );
  } else {
    content = <span className="rr-roda-txt">{ajudaMeta(rec.ajuda).emoji} ajuda usada ✓</span>;
  }

  return (
    <div className="rr-roda">
      {content}
      {open && <Wheel day={day} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Wheel({ day, onClose }: { day: string; onClose: () => void }) {
  const spin = useGame((s) => s.spin);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle');
  const [result, setResult] = useState<AjudaId | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const go = () => {
    if (phase !== 'idle') return;
    const res = spin(day);
    setResult(res);
    setPhase('spinning');
    let delay = 55;
    const step = () => {
      setIdx((x) => (x + 1) % AJUDAS.length);
      delay *= 1.13;
      if (delay < 340) {
        timer.current = setTimeout(step, delay);
      } else {
        setIdx(AJUDAS.findIndex((a) => a.id === res));
        setPhase('done');
      }
    };
    timer.current = setTimeout(step, delay);
  };

  const meta = AJUDAS[idx];
  const done = phase === 'done' && result;

  return createPortal(
    <div className="rr-modal" onClick={phase === 'spinning' ? undefined : onClose}>
      <div className="rr-wheel-box" onClick={(e) => e.stopPropagation()}>
        <div className="rr-wheel-title">🎡 Roda do dia</div>
        <div className={`rr-reel ${phase === 'spinning' ? 'spin' : ''} ${done ? 'land' : ''}`}>
          <div className="rr-reel-emoji">{meta.emoji}</div>
          <div className="rr-reel-name">{meta.name}</div>
        </div>

        {done ? (
          <>
            <div className="rr-reel-desc">{ajudaMeta(result!).short}</div>
            <button className="rr-spin-btn done" onClick={onClose}>
              {result === 'nenhuma' ? 'Que azar… fechar' : 'Boa! usar num jogo'}
            </button>
          </>
        ) : (
          <button className="rr-spin-btn" disabled={phase === 'spinning'} onClick={go}>
            {phase === 'spinning' ? 'A rodar…' : 'RODAR'}
          </button>
        )}

        <div className="rr-wheel-slots">
          {AJUDAS.map((a) => (
            <span key={a.id} className="rr-slot" title={a.name}>{a.emoji}</span>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
