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

## B) Live — dados reais OddsPapi

Pré-requisitos: conta **OddsPapi** (B2B/paga; WebSocket é tier Pro — o REST
polling chega para pré-jogo) e um projeto **Supabase**.

### 1. Supabase
```bash
# cria o projeto em supabase.com, depois:
supabase link --project-ref <ref>
supabase db push                 # aplica supabase/migrations/0001_init.sql
```

### 2. Segredos das Edge Functions (servidor — a chave OddsPapi fica aqui)
```bash
supabase secrets set \
  ODDSPAPI_API_KEY=...           \
  ODDSPAPI_BASE_URL=https://api.oddspapi.io/v1 \
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=...  \
  ENGINE_EDGE_THRESHOLD=0.02 ENGINE_SHARP_SOURCE=pinnacle \
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...   # opcional (alertas)

supabase functions deploy scan-odds telegram-alert
```

### 3. ⚠️ Confirmar o mapeamento OddsPapi (passo crítico)
O mapeamento da resposta foi construído a partir da estrutura **documentada**
(`bookmakerOdds[casa].markets[id].outcomes`), mas os **nomes exatos** de alguns
campos dependem do teu plano. Antes de confiar nas value bets:

1. Faz uma chamada real, ex.: `GET /odds?fixtureId=<um_id>` com a tua chave.
2. Compara com o esperado em `src/data/oddsPapiNormalize.ts` (e o espelho Deno
   `supabase/functions/_shared/oddspapi.ts`).
3. Ajusta **só** três sítios se algo diferir:
   - `BOOKMAKER_SLUGS` — os slugs reais (ex.: `pinnacle`, `betfair_ex`, ...).
   - `mapMarket` — os ids/nomes de mercado (1X2, totals, btts).
   - `readOutcome` — o campo do preço (`price`/`odds`/`value`) e da seleção.
4. Atualiza o `sample` em `tests/oddspapi.test.ts` com a resposta real e corre
   `npm test` — passa a validar contra dados verdadeiros.

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
