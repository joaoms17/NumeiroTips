/** Sincroniza o estado partilhado (Supabase) com o store, em tempo real. */
import { useEffect } from 'react';
import { useGame } from '../game/store';
import { isOnline, fetchState, subscribe } from '../game/online';

export function useOnlineSync() {
  const setRemote = useGame((s) => s.setRemote);
  useEffect(() => {
    if (!isOnline()) return;
    let alive = true;
    const refresh = () => {
      fetchState()
        .then((st) => { if (alive) setRemote(st); })
        .catch((e) => console.warn('[online] fetch falhou', e));
    };
    refresh();
    const unsub = subscribe(refresh);
    return () => { alive = false; unsub(); };
  }, [setRemote]);
}
