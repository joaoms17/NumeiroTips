/** Carrega jogos reais do Mundial 2026 (API-Football) e injeta no store. */
import { useEffect } from 'react';
import { useGame } from '../game/store';
import { loadLiveFixtures } from '../game/liveFixtures';

export function useFixtures() {
  const setMatches = useGame((s) => s.setMatches);
  const setFixturesStatus = useGame((s) => s.setFixturesStatus);
  useEffect(() => {
    let alive = true;
    setFixturesStatus('loading');
    loadLiveFixtures()
      .then((m) => {
        if (!alive) return;
        if (m.length > 0) {
          setMatches(m);
          setFixturesStatus('ready');
        } else {
          setFixturesStatus('empty');
        }
      })
      .catch((e) => {
        if (!alive) return;
        console.warn('[fixtures] jogos reais indisponíveis:', e);
        setFixturesStatus('empty');
      });
    return () => { alive = false; };
  }, [setMatches, setFixturesStatus]);
}
