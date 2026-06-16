/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_THE_ODDS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Identificador do build (data/hora), injetado pelo Vite. */
declare const __BUILD_ID__: string;
