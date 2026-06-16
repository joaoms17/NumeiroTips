-- ==========================================================================
-- NumeiroTips — schema inicial
-- Modelo de dados de value betting (+EV): bookmakers, eventos, mercados,
-- snapshots de odds, preços justos, value bets, apostas e banca.
-- ==========================================================================

create extension if not exists "pgcrypto";

-- ---- bookmakers ----------------------------------------------------------
-- tipo: sharp (régua, p/ calcular o justo) | soft (casa-alvo) | exchange
create table if not exists bookmakers (
  id         text primary key,                 -- 'pinnacle', 'betfair', 'betclic', '1xbet'
  nome       text not null,
  tipo       text not null check (tipo in ('sharp', 'soft', 'exchange')),
  -- só relevante para casas-alvo: 'licenciada' (SRIJ) | 'cinzenta'
  risco      text check (risco in ('licenciada', 'cinzenta')),
  criado_em  timestamptz not null default now()
);

insert into bookmakers (id, nome, tipo, risco) values
  ('pinnacle', 'Pinnacle',          'sharp',    null),
  ('betfair',  'Betfair Exchange',  'exchange', null),
  ('betclic',  'Betclic',           'soft',     'licenciada'),
  ('1xbet',    '1xBet',             'soft',     'cinzenta')
on conflict (id) do nothing;

-- ---- events --------------------------------------------------------------
create table if not exists events (
  id        text primary key,                  -- id estável da fonte (OddsPapi)
  desporto  text not null default 'football',
  liga      text not null,
  casa      text not null,                      -- equipa da casa
  fora      text not null,                      -- equipa de fora
  inicio    timestamptz not null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_events_inicio on events (inicio);

-- ---- markets -------------------------------------------------------------
create table if not exists markets (
  id        text primary key,                  -- 'evt1:1x2:home'
  event_id  text not null references events (id) on delete cascade,
  tipo      text not null,                      -- '1x2','over_under','btts','ah','dnb'
  linha     numeric,                            -- ex.: 2.5 (over/under), -0.5 (AH)
  selecao   text not null,                      -- rótulo da seleção
  criado_em timestamptz not null default now()
);
create index if not exists idx_markets_event on markets (event_id);

-- ---- odds_snapshots ------------------------------------------------------
-- Histórico de odds capturadas (uma linha por casa/seleção/captura).
create table if not exists odds_snapshots (
  id            bigint generated always as identity primary key,
  market_id     text not null references markets (id) on delete cascade,
  bookmaker_id  text not null references bookmakers (id),
  odd           numeric not null check (odd > 1),
  volume        numeric,                          -- liquidez (exchanges)
  captado_em    timestamptz not null default now()
);
create index if not exists idx_odds_market_time on odds_snapshots (market_id, captado_em desc);
create index if not exists idx_odds_book_time on odds_snapshots (bookmaker_id, captado_em desc);

-- ---- fair_prices ---------------------------------------------------------
-- Preço justo (de-vigged) por mercado, calculado da régua sharp.
create table if not exists fair_prices (
  id           bigint generated always as identity primary key,
  market_id    text not null references markets (id) on delete cascade,
  prob_justa   numeric not null check (prob_justa > 0 and prob_justa <= 1),
  odd_justa    numeric not null check (odd_justa > 1),
  metodo       text not null check (metodo in ('shin', 'proportional')),
  fonte        text not null references bookmakers (id),   -- régua usada
  calculado_em timestamptz not null default now()
);
create index if not exists idx_fair_market_time on fair_prices (market_id, calculado_em desc);

-- ---- value_bets ----------------------------------------------------------
-- Sinal +EV vivo: melhor edge entre as casas-alvo para uma seleção.
create table if not exists value_bets (
  id          text primary key,                 -- = market_id (seleção) p/ upsert estável
  market_id   text not null references markets (id) on delete cascade,
  book_id     text not null references bookmakers (id),   -- casa recomendada
  odd_casa    numeric not null check (odd_casa > 1),
  odd_justa   numeric not null check (odd_justa > 1),
  prob_justa  numeric not null,
  edge        numeric not null,                 -- EV por unidade
  kelly       numeric not null default 0,       -- fração aplicada
  stake       numeric,                          -- € sugerido
  estado      text not null default 'ativo'     -- 'ativo' | 'expirado'
                check (estado in ('ativo', 'expirado')),
  -- snapshot por casa-alvo (Betclic/1xBet) para line shopping na UI
  books       jsonb not null default '[]'::jsonb,
  -- dados de apresentação do evento/seleção (evita joins no Realtime):
  -- { league, home, away, startsAt, market, line, selection_label, fair_method, sharp_source }
  meta        jsonb not null default '{}'::jsonb,
  detetado_em timestamptz not null default now(),
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_vb_estado_edge on value_bets (estado, edge desc);

-- ---- bets (tracker) ------------------------------------------------------
create table if not exists bets (
  id            text primary key default gen_random_uuid()::text,
  value_bet_id  text,                            -- referência solta (a vb pode expirar)
  utilizador    uuid,                            -- auth.users (RLS); null no modo local
  descricao     text not null,
  book_id       text not null references bookmakers (id),
  stake         numeric not null check (stake >= 0),
  odd           numeric not null check (odd > 1),
  odd_justa     numeric,
  edge          numeric,
  resultado     text not null default 'pending'
                  check (resultado in ('pending', 'won', 'lost', 'void', 'cashout')),
  pnl           numeric,
  clv           numeric,                         -- closing line value
  colocado_em   timestamptz not null default now(),
  liquidado_em  timestamptz
);
create index if not exists idx_bets_user_time on bets (utilizador, colocado_em desc);

-- ---- bankroll ------------------------------------------------------------
create table if not exists bankroll (
  id            text primary key default gen_random_uuid()::text,
  utilizador    uuid,
  montante      numeric not null check (montante >= 0),
  atualizado_em timestamptz not null default now()
);

-- ---- Realtime ------------------------------------------------------------
-- Publica as tabelas que o frontend ouve em tempo real.
alter publication supabase_realtime add table value_bets;
alter publication supabase_realtime add table odds_snapshots;

-- ---- RLS (apostas/banca por utilizador) ----------------------------------
-- App pessoal: dados de mercado são públicos (anon read); apostas e banca são
-- privados por utilizador autenticado.
alter table bets enable row level security;
alter table bankroll enable row level security;

create policy "bets do próprio" on bets
  for all using (auth.uid() = utilizador) with check (auth.uid() = utilizador);
create policy "bankroll do próprio" on bankroll
  for all using (auth.uid() = utilizador) with check (auth.uid() = utilizador);

-- Mercado: leitura pública (anon), escrita só pelo service role (edge function).
alter table events enable row level security;
alter table markets enable row level security;
alter table odds_snapshots enable row level security;
alter table fair_prices enable row level security;
alter table value_bets enable row level security;
alter table bookmakers enable row level security;

create policy "leitura pública eventos" on events for select using (true);
create policy "leitura pública mercados" on markets for select using (true);
create policy "leitura pública odds" on odds_snapshots for select using (true);
create policy "leitura pública justos" on fair_prices for select using (true);
create policy "leitura pública value bets" on value_bets for select using (true);
create policy "leitura pública bookmakers" on bookmakers for select using (true);
-- (a escrita destas tabelas usa o service role, que ignora RLS)
