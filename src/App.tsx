import { useState } from 'react';
import { useOddsFeed } from './hooks/useOddsFeed';
import { useStore, selectFilteredFeed } from './state/store';
import { Feed } from './components/Feed';
import { Filters } from './components/Filters';
import { KellyCalculator } from './components/KellyCalculator';
import { BetTracker } from './components/BetTracker';
import { Exposure } from './components/Exposure';
import { Settings } from './components/Settings';
import { ago } from './lib/format';
import { useNow } from './hooks/useNow';

type Tab = 'feed' | 'kelly' | 'tracker' | 'exposicao' | 'definicoes';

export default function App() {
  useOddsFeed();
  const [tab, setTab] = useState<Tab>('feed');
  const connected = useStore((s) => s.connected);
  const sourceName = useStore((s) => s.sourceName);
  const lastTickAt = useStore((s) => s.lastTickAt);
  const feedCount = useStore((s) => selectFilteredFeed(s).length);
  const pendingCount = useStore((s) => s.bets.filter((b) => b.result === 'pending').length);
  const now = useNow(1000);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▲ NumeiroTips</span>
          <span className="tag">+EV terminal</span>
        </div>
        <span className={`status-pill`}>
          <span className={`dot ${connected ? 'live' : ''}`} />
          {connected ? sourceName : 'desligado'}
        </span>
        {lastTickAt > 0 && (
          <span className="status-pill mono" title="Última atualização de odds">
            tick {ago(new Date(lastTickAt).toISOString(), now)}
          </span>
        )}
        <div className="spacer" />
        <span className="status-pill mono">{feedCount} +EV</span>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')}>
          Feed
          {feedCount > 0 && <span className="badge">{feedCount}</span>}
        </button>
        <button className={`tab ${tab === 'kelly' ? 'active' : ''}`} onClick={() => setTab('kelly')}>
          Kelly
        </button>
        <button
          className={`tab ${tab === 'tracker' ? 'active' : ''}`}
          onClick={() => setTab('tracker')}
        >
          Tracker
          {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>
        <button
          className={`tab ${tab === 'exposicao' ? 'active' : ''}`}
          onClick={() => setTab('exposicao')}
        >
          Exposição
        </button>
        <button
          className={`tab ${tab === 'definicoes' ? 'active' : ''}`}
          onClick={() => setTab('definicoes')}
        >
          Definições
        </button>
      </nav>

      <main className="content">
        {tab === 'feed' && (
          <>
            <Filters />
            <Feed />
          </>
        )}
        {tab === 'kelly' && <KellyCalculator />}
        {tab === 'tracker' && <BetTracker />}
        {tab === 'exposicao' && <Exposure />}
        {tab === 'definicoes' && <Settings />}
      </main>
    </div>
  );
}
