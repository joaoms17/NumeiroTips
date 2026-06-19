/** RATING ROYALE — shell mobile com nav inferior, login e toast. */
import { useEffect, useState, type CSSProperties } from 'react';
import { useGame } from './game/store';
import { friendById, APP_NAME } from './game/config';
import { useOnlineSync } from './hooks/useOnlineSync';
import { Login } from './components/game/Login';
import { Jogos } from './components/game/Jogos';
import { Tabela } from './components/game/Tabela';
import { Regras } from './components/game/Regras';

type Tab = 'jogos' | 'tabela' | 'regras';

export default function App() {
  useOnlineSync();
  const meId = useGame((s) => s.meId);
  const online = useGame((s) => s.online);
  const me = friendById(meId);
  const [tab, setTab] = useState<Tab>('jogos');

  if (!me) {
    return (
      <div className="rr-app">
        <Login />
      </div>
    );
  }

  return (
    <div className="rr-app" style={{ '--me': me.color } as CSSProperties}>
      <header className="rr-top">
        <span className="rr-top-logo">
          👑 {APP_NAME}
          <span className={`rr-net ${online ? 'on' : ''}`} title={online ? 'Online (partilhado)' : 'Local'}>
            {online ? '● online' : '○ local'}
          </span>
        </span>
        <span className="rr-top-me" style={{ '--c': me.color } as CSSProperties}>
          {me.emoji} {me.name}
        </span>
      </header>

      <main className="rr-main" key={tab}>
        {tab === 'jogos' && <Jogos />}
        {tab === 'tabela' && <Tabela />}
        {tab === 'regras' && <Regras />}
      </main>

      <nav className="rr-nav">
        <NavBtn label="Jogos" icon="⚽" active={tab === 'jogos'} onClick={() => setTab('jogos')} />
        <NavBtn label="Tabela" icon="🏆" active={tab === 'tabela'} onClick={() => setTab('tabela')} />
        <NavBtn label="Regras" icon="📜" active={tab === 'regras'} onClick={() => setTab('regras')} />
      </nav>

      <Toast />
    </div>
  );
}

function NavBtn({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`rr-nav-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="rr-nav-icon">{icon}</span>
      <span className="rr-nav-lbl">{label}</span>
    </button>
  );
}

function Toast() {
  const flash = useGame((s) => s.flash);
  const setFlash = useGame((s) => s.setFlash);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [flash, setFlash]);
  if (!flash) return null;
  return <div className={`rr-toast ${flash.kind} pop-in`}>{flash.text}</div>;
}
