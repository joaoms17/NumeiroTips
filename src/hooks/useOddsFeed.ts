/**
 * Liga a fonte de dados ao store.
 *
 * - Modo mock (default): instancia o MockOddsProvider local.
 * - Modo live: subscreve o Supabase Realtime (snapshots normalizados pela
 *   Edge Function scan-odds). Se Supabase não estiver configurado, cai no mock.
 *
 * Em ambos os casos cada lote de snapshots é passado a `ingestSnapshots`, que
 * corre o motor e atualiza o feed incrementalmente.
 */
import { useEffect } from 'react';
import { MockOddsProvider } from '../data/mockProvider';
import { useStore } from '../state/store';
import { isLiveMode } from '../lib/env';
import { subscribeLiveValueBets } from '../data/liveProvider';

export function useOddsFeed() {
  const ingest = useStore((s) => s.ingestSnapshots);
  const setLiveValueBets = useStore((s) => s.setLiveValueBets);
  const setConnection = useStore((s) => s.setConnection);

  useEffect(() => {
    let cleanup = () => {};

    if (isLiveMode()) {
      // Produção: as value bets vêm já calculadas pela Edge Function via Realtime.
      setConnection(true, 'OddsPapi (live)');
      cleanup = subscribeLiveValueBets((bets) => setLiveValueBets(bets));
    } else {
      // Demo: motor a correr no cliente sobre snapshots simulados.
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
