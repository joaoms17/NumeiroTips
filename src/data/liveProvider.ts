/**
 * Caminho LIVE via Supabase Realtime.
 * ===================================
 *
 * Arquitetura de produção: a Edge Function `scan-odds` consome a OddsPapi,
 * corre o motor (de-vig → edge → Kelly) e escreve as value bets em `value_bets`
 * (com `meta` desnormalizada para apresentação). O frontend NÃO fala com a
 * OddsPapi (a chave fica no servidor) — apenas ouve `value_bets` via Realtime e
 * mapeia cada linha diretamente para o tipo `ValueBet` que a UI já renderiza.
 *
 * Faz um fetch inicial das value bets ativas e depois subscreve INSERT/UPDATE/
 * DELETE, mantendo um cache local que é re-emitido a cada alteração.
 */
import type { ValueBet, BookEdge, TargetBook } from '../lib/types';
import { getSupabase } from '../lib/supabase';
import { deepLinkForEvent } from '../lib/deeplinks';

export type ValueBetsListener = (bets: ValueBet[]) => void;

interface ValueBetRow {
  id: string;
  market_id: string;
  book_id: string;
  odd_casa: number;
  odd_justa: number;
  prob_justa: number;
  edge: number;
  kelly: number;
  stake: number | null;
  estado: string;
  books: Array<{ book: string; odd: number; edge: number; isValue: boolean }>;
  meta: {
    league?: string;
    home?: string;
    away?: string;
    startsAt?: string;
    market?: string;
    line?: number | null;
    selection_label?: string;
    fair_method?: 'shin' | 'proportional';
    sharp_source?: 'pinnacle' | 'betfair';
  };
  detetado_em: string;
  atualizado_em: string;
}

/** Mapeia uma linha `value_bets` (+meta) para o `ValueBet` da UI. */
export function mapValueBetRow(row: ValueBetRow): ValueBet {
  const meta = row.meta ?? {};
  const home = meta.home ?? '';
  const away = meta.away ?? '';
  const market = (meta.market ?? '1x2') as ValueBet['selection']['market'];
  const line = meta.line ?? null;

  const books: BookEdge[] = (row.books ?? []).map((b) => ({
    book: b.book as TargetBook,
    odd: b.odd,
    edge: b.edge,
    isValue: b.isValue,
    deepLink: deepLinkForEvent(b.book as TargetBook, home, away),
  }));

  return {
    id: row.id,
    event: {
      id: row.market_id.split(':')[0],
      sport: 'football',
      league: meta.league ?? '',
      home,
      away,
      startsAt: meta.startsAt ?? row.detetado_em,
    },
    selection: {
      id: row.market_id,
      eventId: row.market_id.split(':')[0],
      market,
      line,
      label: meta.selection_label ?? row.market_id,
    },
    fair: {
      selectionId: row.market_id,
      prob: row.prob_justa,
      fairOdd: row.odd_justa,
      method: meta.fair_method ?? 'shin',
      source: meta.sharp_source ?? 'pinnacle',
      computedAt: row.atualizado_em,
    },
    books: books.sort((a, b) => b.edge - a.edge),
    bestBook: row.book_id as TargetBook,
    bestOdd: row.odd_casa,
    bestEdge: row.edge,
    kellyFraction: row.kelly,
    stake: row.stake,
    detectedAt: row.detetado_em,
    updatedAt: row.atualizado_em,
  };
}

export function subscribeLiveValueBets(onBets: ValueBetsListener): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const cache = new Map<string, ValueBet>();
  const emit = () =>
    onBets([...cache.values()].sort((a, b) => b.bestEdge - a.bestEdge));

  // fetch inicial
  supabase
    .from('value_bets')
    .select('*')
    .eq('estado', 'ativo')
    .order('edge', { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        console.error('[live] fetch value_bets falhou', error);
        return;
      }
      for (const row of (data ?? []) as ValueBetRow[]) cache.set(row.id, mapValueBetRow(row));
      emit();
    });

  // realtime
  const channel = supabase
    .channel('value-bets-stream')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'value_bets' },
      (payload) => {
        const row = (payload.new ?? payload.old) as ValueBetRow;
        if (!row?.id) return;
        if (payload.eventType === 'DELETE' || row.estado === 'expirado') {
          cache.delete(row.id);
        } else {
          cache.set(row.id, mapValueBetRow(row));
        }
        emit();
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
