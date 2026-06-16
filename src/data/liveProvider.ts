/**
 * Subscrição live via Supabase Realtime.
 *
 * Em produção a Edge Function `scan-odds` consome a OddsPapi, calcula tudo e
 * escreve em `value_bets` + `odds_snapshots`. O frontend NÃO fala com a
 * OddsPapi diretamente (a chave fica no servidor). Aqui ouvimos as alterações
 * da tabela e reconstruímos MarketSnapshots para o motor local poder
 * re-confirmar/re-ordenar — ou, em alternativa, consumir value_bets já prontas.
 *
 * Implementação mínima: ouve mudanças em `odds_snapshots`. Se a tabela ainda
 * não existir/estiver vazia, não emite nada (a app continua a mostrar o mock se
 * for esse o modo). Mantém-se como ponto de extensão da Fase 1→live.
 */
import type { MarketSnapshot } from '../lib/types';
import { getSupabase } from '../lib/supabase';

export function subscribeLive(onSnapshots: (snaps: MarketSnapshot[]) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  // Ponto de extensão: aqui far-se-ia o fetch inicial + canal realtime que
  // reconstrói snapshots a partir de odds_snapshots/markets/events. Deixa-se
  // o canal preparado para quando as tabelas estiverem populadas.
  const channel = supabase
    .channel('odds-stream')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'odds_snapshots' },
      () => {
        // TODO: agregar por mercado e emitir snapshots. Mantém o contrato.
        void onSnapshots;
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
