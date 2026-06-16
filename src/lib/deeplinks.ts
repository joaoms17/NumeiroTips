/**
 * Deep-links de 1 clique para o boletim das casas-alvo (Fase 2).
 *
 * Os esquemas reais de deep-link mudam com frequência e dependem de
 * IDs internos da casa que a OddsPapi normaliza. Aqui geramos links de
 * "melhor esforço" para o evento; quando a OddsPapi fornecer o link direto
 * do mercado, substitui-se por esse. Mantém-se a função centralizada para
 * ser trivial de atualizar.
 */
import type { MarketSnapshot, Selection, TargetBook } from './types';

export function deepLinkFor(
  book: TargetBook,
  snap: MarketSnapshot,
  _sel: Selection,
): string {
  const q = encodeURIComponent(`${snap.event.home} ${snap.event.away}`);
  switch (book) {
    case 'betclic':
      // Pesquisa do evento no site da Betclic PT.
      return `https://www.betclic.pt/futebol-s1?q=${q}`;
    case '1xbet':
      return `https://1xbet.com/pt/search?text=${q}`;
    default:
      return '#';
  }
}
