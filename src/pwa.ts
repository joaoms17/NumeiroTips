/** Versão do build (data/hora), injetada pelo Vite. */
export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

/**
 * Hard refresh: desregista service workers, limpa todas as caches e recarrega
 * sem cache. Garante a última versão mesmo com PWA instalada.
 */
export async function hardRefresh(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn('[pwa] hard refresh — limpeza falhou', e);
  } finally {
    // cache-busting + reload
    const url = new URL(window.location.href);
    url.searchParams.set('_', Date.now().toString());
    window.location.replace(url.toString());
  }
}

/**
 * Registo do service worker (PWA). Só em produção e se suportado.
 * Em dev não registamos para não atrapalhar o HMR do Vite.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('[pwa] registo do service worker falhou', e);
    });
  });
}
