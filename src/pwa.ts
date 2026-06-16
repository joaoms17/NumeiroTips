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
