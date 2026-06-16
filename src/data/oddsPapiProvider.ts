/**
 * Cliente OddsPapi (produção).
 * ===========================
 *
 * A OddsPapi expõe Betclic, 1xBet, Pinnacle e Betfair numa API normalizada com
 * streaming. Estratégia de frescura:
 *   - WebSocket quando disponível (push imediato das alterações de odds);
 *   - fallback para polling curto (4s pré-jogo) se o WS falhar.
 *
 * IMPORTANTE: a chave de API NUNCA deve estar no frontend. Em produção esta
 * subscrição passa por uma Edge Function/Proxy do Supabase que detém a chave;
 * o frontend recebe os snapshots já normalizados via Supabase Realtime
 * (ver supabase/functions/scan-odds e useValueBets `live`). Esta classe está
 * aqui para o caso de uso server-side e para documentar o contrato de
 * normalização que mapeia a resposta OddsPapi → MarketSnapshot.
 */
import type { MarketSnapshot } from '../lib/types';
import type { OddsProvider, SnapshotListener } from './provider';

export interface OddsPapiConfig {
  apiKey: string;
  baseUrl: string;
  wsUrl?: string;
  /** Ligas/desportos a subscrever. */
  leagues?: string[];
  pollMs?: number;
}

export class OddsPapiProvider implements OddsProvider {
  readonly name = 'OddsPapi';
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

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
          const raw = JSON.parse(ev.data);
          listener(normalizeOddsPapi(raw));
        } catch (e) {
          console.error('[oddspapi] parse falhou', e);
        }
      };
      this.ws.onerror = () => {
        console.warn('[oddspapi] WS erro → fallback polling');
        this.ws?.close();
        this.startPolling(listener);
      };
    } catch (e) {
      console.warn('[oddspapi] WS indisponível → polling', e);
      this.startPolling(listener);
    }
  }

  private startPolling(listener: SnapshotListener) {
    const poll = async () => {
      try {
        const res = await fetch(`${this.config.baseUrl}/odds`, {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        listener(normalizeOddsPapi(raw));
      } catch (e) {
        console.error('[oddspapi] poll falhou', e);
      }
    };
    poll();
    this.timer = setInterval(poll, this.config.pollMs ?? 4000);
  }

  private close() {
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

/**
 * Mapeia a resposta da OddsPapi → MarketSnapshot[].
 *
 * O formato exato depende do plano/endpoint da OddsPapi. Implementa-se o
 * mapeamento esperando uma estrutura por evento→mercado→casa→seleção. Quando
 * tiveres a resposta real, ajusta SÓ esta função; o resto do motor não muda.
 */
export function normalizeOddsPapi(raw: unknown): MarketSnapshot[] {
  // Placeholder defensivo: se vier vazio/diferente, devolve [].
  if (!raw || typeof raw !== 'object') return [];
  const events = (raw as { events?: unknown[] }).events;
  if (!Array.isArray(events)) return [];
  // TODO: implementar o mapeamento concreto quando o schema OddsPapi estiver
  // confirmado. Mantém-se o contrato de tipos para o motor a jusante.
  return [];
}
