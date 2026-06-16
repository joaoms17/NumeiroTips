import { useEffect } from 'react';

/**
 * Atalhos de teclado globais. Ignora quando o foco está num input/select/
 * textarea (exceto Escape, que desfoca). Mapa: tecla → handler.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');

      if (e.key === 'Escape' && typing) {
        (el as HTMLElement).blur();
        return;
      }
      if (typing) return; // não interceptar enquanto se escreve
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const fn = map[e.key];
      if (fn) fn(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map]);
}
