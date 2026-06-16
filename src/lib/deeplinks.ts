/**
 * Deep-links de 1 clique para o boletim das casas-alvo (Fase 2).
 *
 * Os esquemas reais de deep-link mudam com frequência e dependem de IDs
 * internos da casa que a OddsPapi normaliza. Aqui geramos links de "melhor
 * esforço" para o evento; quando a OddsPapi fornecer o link direto do mercado,
 * substitui-se por esse. Função centralizada para ser trivial de atualizar.
 */
import type { MarketSnapshot, Selection, TargetBook } from './types';

/** Link de pesquisa do evento na casa-alvo, a partir dos nomes das equipas. */
export function deepLinkForEvent(book: TargetBook, home: string, away: string): string {
  const q = encodeURIComponent(`${home} ${away}`);
  switch (book) {
    case 'betclic':
      return `https://www.betclic.pt/futebol-s1?q=${q}`;
    case '1xbet':
      return `https://1xbet.com/pt/search?text=${q}`;
    default:
      return '#';
  }
}

export function deepLinkFor(book: TargetBook, snap: MarketSnapshot, _sel: Selection): string {
  return deepLinkForEvent(book, snap.event.home, snap.event.away);
}
