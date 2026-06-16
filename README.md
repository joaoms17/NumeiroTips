# ▲ NumeiroTips — +EV Terminal

Aplicação **pessoal** de _value betting_ (+EV) para apostas desportivas, com
estética "terminal quant". Usa preços **sharp** (Pinnacle / Betfair Exchange)
como probabilidade "verdadeira" e deteta quando a **Betclic** ou a **1xBet**
pagam acima do justo.

> **Aviso.** Ferramenta de análise pessoal. Não coloca apostas automaticamente —
> confirmas sempre tu. Joga com responsabilidade: os edges são pequenos (1–5%) e
> a variância é real. Apoio: SICAD / Linha Vida **1414**.

---

## O motor em 6 passos

1. Vai buscar o preço **sharp** (Pinnacle e/ou Betfair) para cada mercado.
2. Limpa a margem com o método de **Shin** (fallback proporcional) → probabilidade
   e odd **justas**.
3. Vai buscar a **mesma seleção** só na Betclic e na 1xBet.
4. `edge = odd_casa × prob_justa − 1`, calculado para cada casa.
5. Sinaliza onde `edge ≥ limiar` (default 2%). Se ambas forem +EV, recomenda a de
   **odd mais alta** (line shopping). Mostra as duas lado a lado.
6. Ordena o feed por **edge decrescente**.

Tudo isto está em [`src/engine/engine.ts`](src/engine/engine.ts), puro e
reutilizável (browser **e** Edge Function).

## Matemática (documentada e testada)

| Conceito | Fórmula | Ficheiro |
|---|---|---|
| Implícita | `p = 1/odd` | [`math/devig.ts`](src/lib/math/devig.ts) |
| De-vig Shin | `p_i(z) = (√(z² + 4(1−z)·π_i²/B) − z) / (2(1−z))`, z tal que Σp=1 | [`math/devig.ts`](src/lib/math/devig.ts) |
| De-vig proporcional (fallback) | `p_i = (1/odd_i) / B` | [`math/devig.ts`](src/lib/math/devig.ts) |
| EV por unidade | `EV = p · odd_casa − 1` | [`math/ev.ts`](src/lib/math/ev.ts) |
| Kelly | `f = (b·p − q)/b`, `b=odd−1`, `q=1−p`, fração, nunca < 0 | [`math/kelly.ts`](src/lib/math/kelly.ts) |
| CLV | `CLV = odd_apostada / odd_fecho_sharp_sem_margem − 1` | [`math/clv.ts`](src/lib/math/clv.ts) |

O método de Shin modela a margem como resultado de uma fração `z` de apostadores
informados (_insiders_) e corrige o viés favorito-azarão melhor que o
proporcional. Resolvemos `z` por bisseção. **27 testes** cobrem as fórmulas e os
casos-limite: `npm test`.

## Stack

- **Frontend:** React + TypeScript + Vite (mobile-first, estética terminal escura).
- **Estado:** Zustand + persistência leve em `localStorage`.
- **Backend (opcional):** Supabase (Postgres + Edge Functions + Auth + Realtime).
- **Hosting:** Vercel (+ Cron de rede de segurança).
- **Fonte de dados:** OddsPapi (Betclic, 1xBet, Pinnacle, Betfair numa API
  normalizada com streaming).

## Arranque rápido (sem chaves nenhumas)

A app **corre sem backend e sem chaves de API**: usa um gerador **mock** que
simula o streaming da OddsPapi (odds a oscilar, janelas +EV a abrir e fechar),
exercitando o pipeline completo e a UI em tempo real.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 27 testes do motor matemático
npm run build   # typecheck + build de produção
```

## Estrutura

```
src/
  lib/math/        de-vig (Shin/proporcional), EV, Kelly, CLV  ← núcleo testado
  engine/          orquestração: snapshot → fair → edge → value bets
  data/            providers: mock (default), OddsPapi, Supabase live
  state/           store (Zustand), exposição por casa
  hooks/           feed em tempo real, alertas, relógio de frescura
  components/      Feed (herói), Filtros, Kelly, Tracker, Exposição, Definições
tests/             testes do motor matemático (vitest)
supabase/
  migrations/      schema (bookmakers, events, markets, odds_snapshots,
                   fair_prices, value_bets, bets, bankroll) + RLS + Realtime
  functions/       scan-odds (motor server-side), telegram-alert
api/scan.ts        Vercel Cron → aciona scan-odds (rede de segurança)
```

## Funcionalidades por fase

**MVP** ✅
- Feed +EV ao vivo: mercado · odd justa · Betclic · 1xBet · melhor · edge% ·
  stake Kelly · "detetado há Xs", com atualização incremental sem piscar.
- Filtros: mercado, edge mínimo, odd mínima, casa, pesquisa.
- Calculadora de Kelly fracionário (default ¼) + banca, com o passo-a-passo da
  fórmula.

**Fase 2** ✅
- Alertas em tempo real: push do browser (`useAlerts`) + bot de Telegram
  (Edge Function `telegram-alert`).
- Bet tracker: registar, liquidar, P/L, ROI.
- CLV tracking: ao liquidar, introduz a odd justa de fecho → calcula o CLV.
- Deep-links de 1 clique para o boletim (Betclic / 1xBet).

**Fase 3** (estrutura preparada)
- Histórico de movimento de linha (`odds_snapshots` já guarda tudo).
- Scanner de arbitragem Betclic ⇄ 1xBet ⇄ Betfair.
- Modelo Poisson/Dixon-Coles para cantos/cartões.

## Ligar a dados reais (produção)

Guia completo passo-a-passo: **[`DEPLOY.md`](DEPLOY.md)**. Em resumo:

1. **Supabase:** cria o projeto, aplica `supabase/migrations/0001_init.sql`.
2. **Segredos** (server-side, nunca no frontend) + `supabase functions deploy
   scan-odds telegram-alert`.
3. **Mapeamento OddsPapi:** já implementado a partir da estrutura **documentada**
   (`bookmakerOdds[casa].markets[id].outcomes`) em
   [`oddsPapiNormalize.ts`](src/data/oddsPapiNormalize.ts) (espelho Deno em
   `supabase/functions/_shared/oddspapi.ts`), com 5 testes a validar a travessia.
   ⚠️ Os **nomes exatos** de alguns campos dependem do teu plano — confirma com
   um exemplo real de `/odds?fixtureId=` e ajusta, se preciso, só
   `BOOKMAKER_SLUGS` / `mapMarket` / `readOutcome`.
4. **Frontend:** define `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e
   `VITE_DATA_MODE=live` (ver `.env.example`). O feed passa a vir de `value_bets`
   via Supabase Realtime (a chave OddsPapi nunca toca no browser).

### Tempo real (frescura)

As janelas fecham em segundos. A frescura vem do **WebSocket da OddsPapi**, não
do Cron:

- **Caminho rápido:** um worker persistente consome o WS da OddsPapi e faz
  _push_ direto para `value_bets`. O Supabase **Realtime** propaga ao frontend,
  que atualiza a tabela incrementalmente (sem refresh).
- **Rede de segurança:** o Vercel Cron (`/api/scan`) aciona `scan-odds`
  periodicamente caso o WS caia. O Cron sozinho é grosseiro demais para
  tempo real — é só o cinto de segurança.

## Honestidade de conta

- **Betclic** (licenciada SRIJ): segura, mas limita vencedores consistentes →
  stakes discretos e arredondados (`discreetStake`). **Começa o MVP só com a
  Betclic** para validar o motor sem risco legal.
- **1xBet** (zona cinzenta, sem licença SRIJ): mais lenta a limitar, mas com
  risco regulatório/de levantamento → não acumular saldo, levantar com
  frequência. O separador **Exposição** avisa quando uma casa está "em risco".

## Licença

Uso pessoal. Sem garantias. Aposta de forma responsável.
