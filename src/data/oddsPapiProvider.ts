/**
 * Cliente OddsPapi (produção).
 * ===========================
 *
 * A OddsPapi expõe Betclic, 1xBet, Pinnacle e Betfair numa API normalizada.
 * Estratégia de frescura:
 *   - WebSocket (tier Pro): push sub-segundo das alterações de odds;
 *   - fallback REST: fetch de fixtures + odds por fixture, em polling curto.
 *
 * IMPORTANTE: a chave de API NUNCA deve estar no frontend. Em produção a
 * subscrição passa por uma Edge Function/Proxy do Supabase que detém a chave;
 * o frontend recebe value bets via Supabase Realtime. Esta classe serve o uso
 * server-side e documenta o contrato de fetch + normalização.
 *
 * O mapeamento concreto da resposta vive em `oddsPapiNormalize.ts` — é o único
 * sítio a afinar contra um exemplo real.
 */
import type { MarketSnapshot } from '../lib/types';
import type { OddsProvider, SnapshotListener } from './provider';
import {
  normalizeFixtureOdds,
  type OddsPapiFixture,
  type OddsPapiOddsResponse,
} from './oddsPapiNormalize';

export interface OddsPapiConfig {
  apiKey: string;
  baseUrl: string;
  wsUrl?: string;
  /** Desporto (slug OddsPapi). */
  sport?: string;
  pollMs?: number;
  /** Limite de fixtures por ciclo (controla custo/latência). */
  maxFixtures?: number;
}

export class OddsPapiProvider implements OddsProvider {
  readonly name = 'OddsPapi';
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private config: OddsPapiConfig) {}

  subscribe(listener: SnapshotListener): () => void {
    if (this.config.wsUrl && typeof WebSocket !== 'undefined') {
      this.connectWs(listener);
    } else {
      this.startPolling(listener);
    }
    return () => this.close();
  }

  private connectWs(listener: SnapshotListener) {
    try {
      const url = `${this.config.wsUrl}?apiKey=${encodeURIComponent(this.config.apiKey)}`;
      this.ws = new WebSocket(url);
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as {
            fixture?: OddsPapiFixture;
            odds?: OddsPapiOddsResponse;
          };
          if (msg.fixture && msg.odds) {
            listener(normalizeFixtureOdds(msg.fixture, msg.odds));
          }
        } catch (e) {
          console.error('[oddspapi] parse WS falhou', e);
        }
      };
      this.ws.onerror = () => {
        console.warn('[oddspapi] WS erro → fallback polling');
        this.ws?.close();
        if (!this.stopped) this.startPolling(listener);
      };
    } catch (e) {
      console.warn('[oddspapi] WS indisponível → polling', e);
      this.startPolling(listener);
    }
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });
    if (!res.ok) throw new Error(`OddsPapi HTTP ${res.status} em ${path}`);
    return (await res.json()) as T;
  }

  /** Um ciclo REST: fixtures pré-jogo → odds por fixture → normaliza → emite. */
  private async pollOnce(listener: SnapshotListener) {
    const sport = this.config.sport ?? 'soccer';
    const fixturesResp = await this.fetchJson<{ fixtures?: OddsPapiFixture[] }>(
      `/fixtures?sport=${sport}&status=prematch`,
    );
    const fixtures = (fixturesResp.fixtures ?? []).slice(0, this.config.maxFixtures ?? 50);

    const all: MarketSnapshot[] = [];
    for (const fx of fixtures) {
      try {
        const odds = await this.fetchJson<OddsPapiOddsResponse>(`/odds?fixtureId=${fx.id}`);
        all.push(...normalizeFixtureOdds(fx, odds));
      } catch (e) {
        console.warn('[oddspapi] odds do fixture falhou', fx.id, e);
      }
    }
    listener(all);
  }

  private startPolling(listener: SnapshotListener) {
    const tick = () => {
      this.pollOnce(listener).catch((e) => console.error('[oddspapi] poll falhou', e));
    };
    tick();
    this.timer = setInterval(tick, this.config.pollMs ?? 4000);
  }

  private close() {
    this.stopped = true;
    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
