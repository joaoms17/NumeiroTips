# Deploy do NumeiroTips

Dois cenários: **demo** (amigos verem, sem chaves) e **live** (dados reais OddsPapi).

---

## A) Demo para amigos (modo mock, ~3 min)

A app corre com odds simuladas, sem backend nem chaves. Mostra o produto inteiro.

1. Vercel → **Add New Project** → importa `joaoms17/NumeiroTips`.
2. Framework: **Vite** (detetado). Build `npm run build`, output `dist`.
3. **Não definas env vars** (`VITE_DATA_MODE` fica em `mock` por defeito).
4. **Deploy.** Partilha o URL.

Notas:
- O `vercel.json` tem um cron `/api/scan`. No plano grátis (Hobby) corre no
  máximo 1x/dia e, sem Supabase, não faz nada — é inofensivo. Se quiseres,
  apaga a secção `"crons"` do `vercel.json` para o demo.
- Os amigos veem **dados simulados**, não odds reais.

---

## B) Live GRÁTIS sem backend — The Odds API (o mais simples)

Dados reais das 4 casas (Pinnacle, Betfair, Betclic, 1xBet) **sem Supabase nem
servidor**: a app corre o motor no browser com a tua chave grátis. Ideal para
uso pessoal.

1. Cria conta grátis em **the-odds-api.com/signup** → copia a API key (500
   créditos/mês).
2. Na Vercel, define as env vars do projeto:
   ```
   VITE_DATA_MODE=theoddsapi
   VITE_THE_ODDS_API_KEY=<a-tua-chave>
   ```
3. **Deploy.** O feed passa a mostrar value bets reais.

⚠️ **Quota.** Cada chamada custa `nº_mercados × nº_regiões` créditos. Com
`regions=eu` e `markets=h2h,totals` são ~2 créditos por liga por ciclo. O
provider faz polling a 30s e mostra os créditos restantes na barra de estado.
Para o demo, reduz as ligas (edita `DEFAULT_LEAGUES` em
`src/data/theOddsApiProvider.ts`) ou aumenta o intervalo. Não dá para tempo-real
de segundos no grátis — para isso, upgrade do The Odds API ou OddsPapi (cenário C).

> Nota: a chave fica visível no bundle do browser. Para uso pessoal tudo bem;
> para partilhares publicamente, usa o cenário C (chave no servidor).

---

## C) Live com backend — Supabase + OddsPapi (ou The Odds API server-side)

Usa o backend quando quiseres a chave escondida (partilha pública), alertas de
Telegram server-side, ou a OddsPapi paga. A fonte do servidor escolhe-se com
`ENGINE_DATA_SOURCE` (`theoddsapi`, default grátis; ou `oddspapi`).

### 1. Supabase
```bash
# cria o projeto em supabase.com, depois:
supabase link --project-ref <ref>
supabase db push                 # aplica supabase/migrations/0001_init.sql
```

### 2a. Segredos — The Odds API (grátis, recomendado)
```bash
supabase secrets set \
  ENGINE_DATA_SOURCE=theoddsapi \
  THE_ODDS_API_KEY=... \
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=...  \
  ENGINE_EDGE_THRESHOLD=0.02 ENGINE_SHARP_SOURCE=pinnacle \
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...   # opcional (alertas)

supabase functions deploy scan-odds telegram-alert
```

### 2b. (alternativa) Segredos — OddsPapi (pago)
```bash
supabase secrets set ENGINE_DATA_SOURCE=oddspapi ODDSPAPI_API_KEY=... \
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
```
⚠️ O mapeamento OddsPapi foi construído da estrutura **documentada**
(`bookmakerOdds[casa].markets[id].outcomes`) mas os nomes exatos dependem do
plano — confirma com um `/odds?fixtureId=` real e ajusta, se preciso, só
`BOOKMAKER_SLUGS`/`mapMarket`/`readOutcome` em `_shared/oddspapi.ts`. O The Odds
API tem schema público estável e **não** precisa desta verificação.

> Os 5 testes de normalização já validam a travessia da estrutura; só os nomes
> dos campos é que precisam de confirmação com um exemplo real.

### 4. Frontend (Vercel) — env vars
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_DATA_MODE=live
```
E para o cron acionar o scan:
```
SUPABASE_FUNCTION_URL=https://<ref>.supabase.co/functions/v1/scan-odds
SUPABASE_SERVICE_ROLE_KEY=...
```
Redeploy.

### 5. Frescura em tempo real
- **Rede de segurança:** o Vercel Cron (`/api/scan`) aciona `scan-odds`. Em
  planos pagos corre ao minuto; no Hobby, diário (insuficiente para tempo real).
- **Caminho rápido (recomendado para janelas de segundos):** um worker
  persistente que consome o **WebSocket** da OddsPapi (tier Pro) e chama
  `scan-odds`/escreve `value_bets` continuamente. O Supabase **Realtime**
  propaga ao frontend, que atualiza a tabela sem refresh.

### Fluxo completo (live)
```
OddsPapi ──(chave, servidor)──▶ scan-odds (de-vig Shin → edge → Kelly)
        └─▶ value_bets (+meta) ──▶ Supabase Realtime ──▶ frontend (feed +EV)
```

---

## Checklist "tudo ON"

- [x] Motor matemático (de-vig Shin, EV, Kelly, CLV) — testado
- [x] Normalização OddsPapi (estrutura documentada) — testada; **falta confirmar
      nomes de campos com 1 exemplo real**
- [x] Edge Function `scan-odds` (fixtures + odds → value_bets +meta)
- [x] Caminho live no frontend (Realtime → feed)
- [x] Alertas Telegram (`telegram-alert`) + push do browser
- [ ] Conta OddsPapi + chave (B2B) — **tua**
- [ ] Projeto Supabase + migration aplicada — **teu**
- [ ] (opcional) Worker WebSocket para frescura sub-segundo
- [ ] (opcional) Supabase Auth para tracker/banca multi-dispositivo
