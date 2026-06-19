/** Ecrã de entrada: escolhe o teu avatar e mete o PIN. Animado. */
import { useState, type CSSProperties } from 'react';
import { FRIENDS, APP_NAME, APP_TAG } from '../../game/config';
import { useGame } from '../../game/store';

export function Login() {
  const login = useGame((s) => s.login);
  const [sel, setSel] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const friend = FRIENDS.find((f) => f.id === sel);

  const press = (d: string) => {
    if (!friend) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        const ok = login(friend.name, next);
        if (!ok) {
          setShake(true);
          setPin('');
          setTimeout(() => setShake(false), 500);
        }
      }, 120);
    }
  };

  return (
    <div className="rr-login">
      <div className="rr-login-head">
        <div className="rr-logo glow">👑 {APP_NAME}</div>
        <div className="rr-tag">{APP_TAG}</div>
      </div>

      {!friend ? (
        <div className="rr-pick-me">
          <div className="rr-pick-me-h">Quem és tu?</div>
          <div className="rr-avatars">
            {FRIENDS.map((f, i) => (
              <button
                key={f.id}
                className="rr-avatar pop-in"
                style={{ '--c': f.color, animationDelay: `${i * 70}ms` } as CSSProperties}
                onClick={() => setSel(f.id)}
              >
                <span className="rr-avatar-emoji">{f.emoji}</span>
                <span className="rr-avatar-name">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`rr-pinpad ${shake ? 'shake' : ''}`}>
          <button className="rr-back" onClick={() => { setSel(null); setPin(''); }}>
            ‹ trocar
          </button>
          <div className="rr-pin-who" style={{ '--c': friend.color } as CSSProperties}>
            <span className="rr-avatar-emoji big">{friend.emoji}</span>
            <span>{friend.name}</span>
          </div>
          <div className="rr-dots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`rr-dot ${i < pin.length ? 'on' : ''}`} />
            ))}
          </div>
          <div className="rr-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button key={d} className="rr-key" onClick={() => press(d)}>{d}</button>
            ))}
            <span />
            <button className="rr-key" onClick={() => press('0')}>0</button>
            <button className="rr-key del" onClick={() => setPin(pin.slice(0, -1))}>⌫</button>
          </div>
          <div className="rr-hint muted">PIN de 4 dígitos</div>
        </div>
      )}
    </div>
  );
}
