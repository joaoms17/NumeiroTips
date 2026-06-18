/**
 * Abstração da fonte de dados.
 *
 * O motor não sabe (nem quer saber) se os snapshots vêm da OddsPapi via
 * WebSocket, de polling REST, ou do gerador mock. Qualquer fonte implementa
 * `OddsProvider`: subscreve e recebe MarketSnapshots à medida que chegam.
 */
import type { MarketSnapshot } from '../lib/types';

/** Recebe um lote de snapshots. `meta.at` = quando os dados foram gerados
 * (epoch ms), se a fonte souber (ex.: coletor agendado). */
export type SnapshotListener = (
  snapshots: MarketSnapshot[],
  meta?: { at?: number },
) => void;

export interface OddsProvider {
  /** Começa a emitir snapshots. Devolve uma função de cleanup. */
  subscribe(listener: SnapshotListener): () => void;
  /** Nome legível da fonte (para o status bar). */
  readonly name: string;
}
