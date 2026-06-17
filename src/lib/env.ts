/** Acesso tipado e seguro às variáveis de ambiente Vite. */

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  dataMode: (import.meta.env.VITE_DATA_MODE as string | undefined) ?? 'mock',
  theOddsApiKey: import.meta.env.VITE_THE_ODDS_API_KEY as string | undefined,
  apiFootballKey: import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined,
};

export type DataMode = 'mock' | 'theoddsapi' | 'live';

/**
 * Modo de dados efetivo, com degradação graciosa:
 *  - 'live'        → Supabase Realtime (value_bets calculadas no servidor)
 *  - 'theoddsapi'  → polling client-side do The Odds API (motor no browser)
 *  - 'mock'        → gerador local (default; sem chaves)
 *
 * Se o modo pedido não tiver as credenciais necessárias, cai no mock.
 */
export function getDataMode(): DataMode {
  if (env.dataMode === 'live' && env.supabaseUrl && env.supabaseAnonKey) return 'live';
  if (env.dataMode === 'theoddsapi' && env.theOddsApiKey) return 'theoddsapi';
  return 'mock';
}

/** Compat: continua a indicar o caminho Supabase Realtime. */
export function isLiveMode(): boolean {
  return getDataMode() === 'live';
}
