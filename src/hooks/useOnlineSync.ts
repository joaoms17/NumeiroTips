/** Sincroniza o estado partilhado (Supabase) com o store, em tempo real. */
import { useEffect } from 'react';
import { useGame } from '../game/store';
import { isOnline, fetchState, fetchPatches, fetchPins, subscribe } from '../game/online';

export function useOnlineSync() {
  const setRemote = useGame((s) => s.setRemote);
  const setPatches = useGame((s) => s.setPatches);
  const setPins = useGame((s) => s.setPins);
  useEffect(() => {
    if (!isOnline()) return;
    let alive = true;
    const refresh = () => {
      fetchState()
        .then((st) => { if (alive) setRemote(st); })
        .catch((e) => console.warn('[online] fetch falhou', e));
      fetchPatches()
        .then((p) => { if (alive) setPatches(p); })
        .catch((e) => console.warn('[online] fetch patches falhou', e));
      fetchPins()
        .then((p) => { if (alive) setPins(p); })
        .catch((e) => console.warn('[online] fetch pins falhou', e));
    };
    refresh();
    const unsub = subscribe(refresh);
    return () => { alive = false; unsub(); };
  }, [setRemote, setPatches, setPins]);
}
