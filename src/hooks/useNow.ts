import { useEffect, useState } from 'react';

/** Relógio partilhado que atualiza a cada `ms` — para o "detetado há Xs". */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
