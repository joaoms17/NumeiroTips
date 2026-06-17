import { useEffect, useState } from 'react';

const PREFIX = 'numeirotips:note:';

/** Nota de texto persistida em localStorage por chave (ex.: id do evento). */
export function useLocalNote(key: string): [string, (v: string) => void] {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState('');

  useEffect(() => {
    try {
      setValue(localStorage.getItem(storageKey) ?? '');
    } catch {
      setValue('');
    }
  }, [storageKey]);

  const update = (v: string) => {
    setValue(v);
    try {
      if (v) localStorage.setItem(storageKey, v);
      else localStorage.removeItem(storageKey);
    } catch {
      /* ignore quota */
    }
  };

  return [value, update];
}
