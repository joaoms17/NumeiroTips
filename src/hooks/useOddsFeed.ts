/**
 * Liga a fonte de dados ao store, segundo o modo efetivo (getDataMode):
 *
 *  - 'live'        → Supabase Realtime: value bets já calculadas no servidor.
 *  - 'theoddsapi'  → polling client-side do The Odds API; o motor corre no
 *                    browser sobre os snapshots (ideal para uso pessoal grátis).
 *  - 'mock'        → gerador local (default, sem chaves).
 *
 * Em qualquer caminho com motor no cliente, cada lote de snapshots passa por
 * `ingestSnapshots`, que corre o motor e atualiza o feed incrementalmente.
 */
import { useEffect } from 'react';
import { MockOddsProvider } from '../data/mockProvider';
import { TheOddsApiProvider } from '../data/theOddsApiProvider';
import { useStore } from '../state/store';
import { getDataMode, env } from '../lib/env';
import { subscribeLiveValueBets } from '../data/liveProvider';

export function useOddsFeed() {
  const ingest = useStore((s) => s.ingestSnapshots);
  const setLiveValueBets = useStore((s) => s.setLiveValueBets);
  const setConnection = useStore((s) => s.setConnection);

  useEffect(() => {
    let cleanup = () => {};
    const mode = getDataMode();

    if (mode === 'live') {
      setConnection(true, 'Supabase Realtime');
      cleanup = subscribeLiveValueBets((bets) => setLiveValueBets(bets));
    } else if (mode === 'theoddsapi') {
      const provider = new TheOddsApiProvider({
        apiKey: env.theOddsApiKey!,
        onQuota: (remaining) =>
          setConnection(true, `The Odds API${remaining != null ? ` · ${remaining}cr` : ''}`),
      });
      setConnection(true, provider.name);
      cleanup = provider.subscribe((snaps) => ingest(snaps));
    } else {
      const provider = new MockOddsProvider(4000);
      setConnection(true, provider.name);
      cleanup = provider.subscribe((snaps) => ingest(snaps));
    }

    return () => {
      cleanup();
      setConnection(false, '—');
    };
  }, [ingest, setLiveValueBets, setConnection]);
}
