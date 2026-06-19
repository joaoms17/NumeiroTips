/** Carrega jogos reais do Mundial 2026 (API-Football) e injeta no store. */
import { useEffect } from 'react';
import { useGame } from '../game/store';
import { loadLiveFixtures } from '../game/liveFixtures';

export function useFixtures() {
  const setMatches = useGame((s) => s.setMatches);
  useEffect(() => {
    loadLiveFixtures()
      .then((m) => { if (m.length > 0) setMatches(m); })
      .catch((e) => console.warn('[fixtures] jogos reais indisponíveis, a usar mock:', e));
  }, [setMatches]);
}
