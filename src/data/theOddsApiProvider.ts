/**
 * Provider The Odds API (REST polling).
 * =====================================
 *
 * Uma única chamada por liga devolve TODOS os eventos com TODAS as casas
 * embutidas (não precisa de chamada por fixture, ao contrário da OddsPapi).
 *
 *   GET /v4/sports/{sport}/odds?regions=eu&markets=h2h,totals
 *       &oddsFormat=decimal&bookmakers=pinnacle,betfair_ex_eu,betclic,onexbet&apiKey=KEY
 *
 * ⚠️ QUOTA (tier grátis = 500 créditos/mês): cada chamada custa
 * `nº_mercados × nº_regiões` créditos. Com `regions=eu` e `markets=h2h,totals`
 * são 2 créditos por liga por ciclo → o grátis dá para ~250 ciclos no MÊS TODO.
 * Isto NÃO é compatível com refresh contínuo: trata-o como "ver de vez em
 * quando", não "deixar a correr". Por isso o default é polling lento (10 min) e
 * UMA liga, e há um travão de segurança (`minCredits`) que pára o polling
 * quando os créditos estão a acabar. O header `x-requests-remaining` da resposta
 * diz quanto resta — expomo-lo no callback `onQuota`.
 *
 * USO CLIENT-SIDE: para uma app PESSOAL podes correr isto no browser com a tua
 * própria chave (o The Odds API permite CORS). Não há backend nem segredo
 * partilhado. Para partilhares publicamente, mantém a chave no servidor
 * (Edge Function scan-odds) — vê _shared/theoddsapi.ts.
 */
import type { MarketSnapshot } from '../lib/types';
import type { OddsProvider, SnapshotListener } from './provider';
import { normalizeTheOddsApiEvent, type TOAEvent } from './theOddsApiNormalize';

export interface TheOddsApiConfig {
  apiKey: string;
  baseUrl?: string;
  /** Regiões (default 'eu' — cobre Betclic/1xBet/Pinnacle/Betfair). */
  regions?: string;
  /** Mercados (default 'h2h,totals,spreads' — os grátis; 'btts' pode ser pago). */
  markets?: string;
  /** Casas a pedir (poupa créditos e ruído). */
  bookmakers?: string;
  /** Ligas (sport keys) a varrer. */
  sportKeys?: string[];
  /** Intervalo de polling em ms (default 600000 = 10 min — protege a quota). */
  pollMs?: number;
  /** Travão: pára o polling quando os créditos restantes caem até aqui (default 10). */
  minCredits?: number;
  /** Callback opcional com os créditos restantes (header da resposta). */
  onQuota?: (remaining: number | null, used: number | null) => void;
}

/**
 * Ligas a varrer por defeito.
 *
 * ⚠️ Em época (ago–mai) usa as ligas domésticas. Em junho/julho de 2026 essas
 * estão paradas e o que está a decorrer é o MUNDIAL — por isso o default agora
 * é só o Mundial (1 liga = menos créditos). Troca via env/props quando a época
 * recomeçar.
 */
const DEFAULT_LEAGUES = [
  'soccer_fifa_world_cup', // ativo jun–jul 2026
  // época doméstica (descomenta quando recomeçar, ~agosto):
  // 'soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a',
  // 'soccer_france_ligue_one', 'soccer_germany_bundesliga', 'soccer_portugal_primeira_liga',
];

export class TheOddsApiProvider implements OddsProvider {
  readonly name = 'The Odds API';
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private config: TheOddsApiConfig) {}

  subscribe(listener: SnapshotListener): () => void {
    const tick = () => {
      this.pollOnce(listener).catch((e) => console.error('[the-odds-api] poll falhou', e));
    };
    tick();
    this.timer = setInterval(tick, this.config.pollMs ?? 600000);
    return () => {
      this.stopped = true;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    };
  }

  private async pollOnce(listener: SnapshotListener) {
    const base = this.config.baseUrl ?? 'https://api.the-odds-api.com/v4';
    const regions = this.config.regions ?? 'eu';
    const markets = this.config.markets ?? 'h2h,totals,spreads';
    const bookmakers = this.config.bookmakers ?? 'pinnacle,betfair_ex_eu,betclic,onexbet';
    const leagues = this.config.sportKeys ?? DEFAULT_LEAGUES;

    const all: MarketSnapshot[] = [];
    for (const sk of leagues) {
      if (this.stopped) return;
      const params = new URLSearchParams({
        regions,
        markets,
        oddsFormat: 'decimal',
        bookmakers,
        apiKey: this.config.apiKey,
      });
      const url = `${base}/sports/${sk}/odds?${params.toString()}`;
      try {
        const res = await fetch(url);
        // quota nos headers
        const remaining = num(res.headers.get('x-requests-remaining'));
        const used = num(res.headers.get('x-requests-used'));
        this.config.onQuota?.(remaining, used);
        // travão de segurança: pára o auto-refresh antes de esgotar a quota
        if (remaining != null && remaining <= (this.config.minCredits ?? 10)) {
          console.warn(`[the-odds-api] créditos quase esgotados (${remaining}) → pára o polling`);
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
          this.stopped = true;
        }
        if (!res.ok) {
          console.warn(`[the-odds-api] ${sk} HTTP ${res.status}`);
          continue;
        }
        const events = (await res.json()) as TOAEvent[];
        for (const ev of events) all.push(...normalizeTheOddsApiEvent(ev));
      } catch (e) {
        console.warn('[the-odds-api] liga falhou', sk, e);
      }
    }
    listener(all);
  }
}

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
