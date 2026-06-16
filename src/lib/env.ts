/** Acesso tipado e seguro às variáveis de ambiente Vite. */

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  dataMode: (import.meta.env.VITE_DATA_MODE as string | undefined) ?? 'mock',
};

/** Há Supabase configurado e modo live pedido? */
export function isLiveMode(): boolean {
  return env.dataMode === 'live' && !!env.supabaseUrl && !!env.supabaseAnonKey;
}
