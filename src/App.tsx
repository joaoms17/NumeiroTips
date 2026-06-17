import { useState, useMemo } from 'react';
import { useOddsFeed } from './hooks/useOddsFeed';
import { useStore, selectFilteredFeed } from './state/store';
import { Feed } from './components/Feed';
import { Filters } from './components/Filters';
import { BetTracker } from './components/BetTracker';
import { Exposure } from './components/Exposure';
import { Settings } from './components/Settings';
import { Arbitrage } from './components/Arbitrage';
import { Analysis } from './components/Analysis';
import { ago } from './lib/format';
import { useNow } from './hooks/useNow';
import { useHotkeys } from './hooks/useHotkeys';
import { getDataMode } from './lib/env';
import { BUILD_ID, hardRefresh } from './pwa';

type Tab = 'feed' | 'analise' | 'arbitragem' | 'tracker' | 'exposicao' | 'definicoes';

function DataModeBanner() {
  const mode = getDataMode();
  if (mode === 'mock') {
    return (
      <div className="banner demo">
        ▲ <strong>MODO DEMO</strong> — odds <strong>simuladas</strong> para mostrar a app. Não são
        apostas reais. Liga o The Odds API (grátis) para dados a sério.
      </div>
    );
  }
  if (mode === 'theoddsapi') {
    return (
      <div className="banner live">
        ● Dados reais via <strong>The Odds API</strong> (tier grátis) — sê frugal com a quota.
      </div>
    );
  }
  return null;
}

export default function App() {
  useOddsFeed();
  const [tab, setTab] = useState<Tab>('feed');
  const connected = useStore((s) => s.connected);
  const sourceName = useStore((s) => s.sourceName);
  const lastTickAt = useStore((s) => s.lastTickAt);
  const feedCount = useStore((s) => selectFilteredFeed(s).length);
  const arbCount = useStore((s) => s.arbs.length);
  const pendingCount = useStore((s) => s.bets.filter((b) => b.result === 'pending').length);
  const now = useNow(1000);

  // Atalhos de teclado: 1–7 troca separador, "/" foca a pesquisa do feed.
  const hotkeys = useMemo(() => {
    const order: Tab[] = ['feed', 'analise', 'arbitragem', 'tracker', 'exposicao', 'definicoes'];
    const map: Record<string, (e: KeyboardEvent) => void> = {
      '/': (e) => {
        setTab('feed');
        // espera o feed montar e foca a pesquisa
        setTimeout(() => document.getElementById('f-search')?.focus(), 0);
        e.preventDefault();
      },
    };
    order.forEach((t, i) => {
      map[String(i + 1)] = () => setTab(t);
    });
    return map;
  }, []);
  useHotkeys(hotkeys);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▲ NumeiroTips</span>
          <span className="tag hide-sm">+EV terminal</span>
        </div>
        <span className="status-pill source-pill" title={connected ? sourceName : 'desligado'}>
          <span className={`dot ${connected ? 'live' : ''}`} />
          <span className="source-name">{connected ? sourceName : 'desligado'}</span>
        </span>
        {lastTickAt > 0 && (
          <span className="status-pill mono hide-sm" title="Última atualização de odds">
            tick {ago(new Date(lastTickAt).toISOString(), now)}
          </span>
        )}
        <div className="spacer" />
        <span className="status-pill mono hide-sm" title="Atalhos: 1–6 separadores · / pesquisa">
          ⌨ 1–6 · /
        </span>
        <span className="status-pill mono hide-sm">{feedCount} +EV</span>
        <span className="status-pill mono hide-sm" title={`Versão do build: ${BUILD_ID}`}>
          v{BUILD_ID}
        </span>
        <button
          className="btn ghost refresh-btn"
          onClick={hardRefresh}
          title="Hard refresh: limpa cache e service worker e recarrega a última versão"
        >
          ⟳
        </button>
      </header>

      <DataModeBanner />

      <nav className="tabs">
        <button className={`tab ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')}>
          Feed
          {feedCount > 0 && <span className="badge">{feedCount}</span>}
        </button>
        <button className={`tab ${tab === 'analise' ? 'active' : ''}`} onClick={() => setTab('analise')}>
          Análise
        </button>
        <button
          className={`tab ${tab === 'arbitragem' ? 'active' : ''}`}
          onClick={() => setTab('arbitragem')}
        >
          Arbitragem
          {arbCount > 0 && <span className="badge">{arbCount}</span>}
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
        {tab === 'analise' && <Analysis />}
        {tab === 'arbitragem' && <Arbitrage />}
        {tab === 'tracker' && <BetTracker />}
        {tab === 'exposicao' && <Exposure />}
        {tab === 'definicoes' && <Settings />}
      </main>
    </div>
  );
}
