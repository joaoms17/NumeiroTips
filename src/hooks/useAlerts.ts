/**
 * Alertas em tempo real (push do browser) — Fase 2.
 *
 * Dispara uma notificação quando surge uma value bet NOVA que cumpre os
 * filtros atuais e um limiar de alerta próprio (para não spammar com edges
 * minúsculos). O bot de Telegram corre server-side (Edge Function
 * telegram-alert) usando o mesmo critério; aqui é a vertente browser.
 *
 * Honestidade: nunca coloca apostas — só avisa. A decisão é sempre do
 * utilizador.
 */
import { useEffect, useRef } from 'react';
import { useStore, selectFilteredFeed } from '../state/store';

export interface AlertOptions {
  enabled: boolean;
  /** Edge mínimo para alertar (default 0.03 = 3%). */
  minEdge: number;
  /** Som curto ao alertar. */
  sound: boolean;
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return Promise.resolve('denied');
  return Notification.requestPermission();
}

export function useAlerts(opts: AlertOptions) {
  const feed = useStore(selectFilteredFeed);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!opts.enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    for (const vb of feed) {
      if (vb.bestEdge < opts.minEdge) continue;
      // Chave inclui a casa+odd para re-alertar se a odd melhorar materialmente.
      const key = `${vb.id}@${vb.bestBook}:${vb.bestOdd.toFixed(2)}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);

      try {
        const n = new Notification('⚡ NumeiroTips — Value Bet', {
          body: `${vb.event.home} v ${vb.event.away}\n${vb.selection.label}\n${vb.bestBook.toUpperCase()} @ ${vb.bestOdd.toFixed(2)} · edge ${(vb.bestEdge * 100).toFixed(1)}%`,
          tag: vb.id,
          silent: !opts.sound,
        });
        n.onclick = () => window.focus();
      } catch {
        /* ignore */
      }
    }

    // Limita o tamanho do set de "vistos".
    if (seen.current.size > 500) {
      seen.current = new Set(Array.from(seen.current).slice(-250));
    }
  }, [feed, opts.enabled, opts.minEdge, opts.sound]);
}
