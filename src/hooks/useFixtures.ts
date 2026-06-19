/**
 * Carrega os jogos do Mundial 2026 com cadeia de fontes (degradação graciosa):
 *   1) API-Football — se houver chave/plano com a época 2026
 *   2) Fallback curado — jogos de exemplo com plantéis completos (sempre jogável)
 *
 * As NOTAS/ONZES ao vivo entram por importação manual do admin (ver online.ts /
 * painel de admin), porque as fontes automáticas grátis (SofaScore) estão
 * bloqueadas por Cloudflare em servidores de datacenter (Vercel).
 */
import { useEffect } from 'react';
import { useGame } from '../game/store';
import { loadLiveFixtures } from '../game/liveFixtures';
import { FALLBACK_MATCHES } from '../game/mockData';
import type { Match } from '../game/types';

async function loadChain(): Promise<Match[]> {
  try {
    const af = await loadLiveFixtures();
    if (af.length > 0) return af;
  } catch (e) {
    console.warn('[fixtures] API-Football falhou, a usar fallback:', e);
  }
  return FALLBACK_MATCHES;
}

export function useFixtures() {
  const setMatches = useGame((s) => s.setMatches);
  const setFixturesStatus = useGame((s) => s.setFixturesStatus);
  const refreshKey = useGame((s) => s.fixturesRefreshKey);
  useEffect(() => {
    let alive = true;
    setFixturesStatus('loading');
    loadChain()
      .then((m) => {
        if (!alive) return;
        setMatches(m.length > 0 ? m : FALLBACK_MATCHES);
        setFixturesStatus('ready');
      })
      .catch(() => {
        if (!alive) return;
        setMatches(FALLBACK_MATCHES);
        setFixturesStatus('ready');
      });
    return () => { alive = false; };
  }, [setMatches, setFixturesStatus, refreshKey]);
}
