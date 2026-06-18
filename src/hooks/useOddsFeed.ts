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
import { SnapshotCacheProvider } from '../data/snapshotCacheProvider';
import { useStore } from '../state/store';
import { getDataMode, getSnapshotUrl, env } from '../lib/env';
import { subscribeLiveValueBets } from '../data/liveProvider';

/** Intervalo de polling do The Odds API (20 min) — protege a quota grátis. */
const POLL_MS = 20 * 60 * 1000;

export function useOddsFeed() {
  const ingest = useStore((s) => s.ingestSnapshots);
  const setLiveValueBets = useStore((s) => s.setLiveValueBets);
  const setConnection = useStore((s) => s.setConnection);
  const setCredits = useStore((s) => s.setCredits);

  useEffect(() => {
    let cleanup = () => {};
    const mode = getDataMode();

    if (mode === 'live') {
      setConnection(true, 'Supabase Realtime');
      cleanup = subscribeLiveValueBets((bets) => setLiveValueBets(bets));
    } else if (mode === 'snapshot') {
      // Caminho durável: lê o snapshot.json do coletor agendado. Zero créditos
      // gastos no browser; o motor corre localmente sobre os snapshots.
      const provider = new SnapshotCacheProvider({ url: getSnapshotUrl()! });
      setCredits(null);
      setConnection(true, provider.name);
      cleanup = provider.subscribe((snaps, meta) => ingest(snaps, meta));
    } else if (mode === 'theoddsapi') {
      // Se já temos um lote recente em cache, adia o 1º scan: ao abrir/atualizar
      // a app mostramos os jogos guardados sem queimar créditos.
      const snapAt = useStore.getState().snapAt;
      const age = snapAt ? Date.now() - snapAt : Infinity;
      const firstDelayMs = age < POLL_MS ? POLL_MS - age : 0;
      const provider = new TheOddsApiProvider({
        apiKey: env.theOddsApiKey!,
        pollMs: POLL_MS,
        firstDelayMs,
        onQuota: (remaining) => {
          setCredits(remaining);
          setConnection(true, `The Odds API${remaining != null ? ` · ${remaining}cr` : ''}`);
        },
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
  }, [ingest, setLiveValueBets, setConnection, setCredits]);
}
