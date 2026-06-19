-- ============================================================================
-- RATING ROYALE — esquema do modo online (Supabase)
-- ============================================================================
-- Corre isto UMA vez no Supabase: Dashboard → SQL Editor → New query → Run.
-- Cria as tabelas partilhadas pelos 4 amigos (uma liga privada) e liga o
-- Realtime. Depois define na Vercel:
--   VITE_SUPABASE_URL       = https://<project-ref>.supabase.co
--   VITE_SUPABASE_ANON_KEY  = (Project Settings → API → anon public)
--
-- Nota: é um jogo privado entre amigos (sem login real), por isso as políticas
-- permitem leitura/escrita à role anónima. Não guardes aqui nada sensível.
-- ============================================================================

-- Palpites: 1 por amigo por jogo
create table if not exists public.rr_picks (
  league        text not null default 'mundial2026',
  friend_id     text not null,
  match_id      text not null,
  footballer_id text not null,
  updated_at    timestamptz not null default now(),
  primary key (league, friend_id, match_id)
);

-- Spins da roda: 1 por amigo por dia (+ onde aplicou a ajuda)
create table if not exists public.rr_spins (
  league               text not null default 'mundial2026',
  friend_id            text not null,
  day                  text not null,
  ajuda                text not null,
  match_id             text,
  second_id            text,
  target_footballer_id text,
  updated_at           timestamptz not null default now(),
  primary key (league, friend_id, day)
);

-- Patches manuais do admin: onze oficial + notas por jogo (de prints FlashScore)
create table if not exists public.rr_ratings (
  league           text not null default 'mundial2026',
  match_id         text not null,
  lineup_confirmed boolean not null default false,
  ratings          jsonb not null default '{}'::jsonb,
  lineup           jsonb,
  updated_at       timestamptz not null default now(),
  primary key (league, match_id)
);

-- RLS + políticas permissivas (jogo privado entre amigos)
alter table public.rr_picks enable row level security;
alter table public.rr_spins enable row level security;
alter table public.rr_ratings enable row level security;

drop policy if exists rr_picks_all on public.rr_picks;
create policy rr_picks_all on public.rr_picks
  for all to anon using (true) with check (true);

drop policy if exists rr_spins_all on public.rr_spins;
create policy rr_spins_all on public.rr_spins
  for all to anon using (true) with check (true);

drop policy if exists rr_ratings_all on public.rr_ratings;
create policy rr_ratings_all on public.rr_ratings
  for all to anon using (true) with check (true);

-- Realtime (atualização ao vivo) — idempotente: só adiciona se ainda não estiver
do $$
declare t text;
begin
  foreach t in array array['rr_picks', 'rr_spins', 'rr_ratings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
