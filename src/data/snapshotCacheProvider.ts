/**
 * Provider de SNAPSHOT em cache (servidor).
 * =========================================
 *
 * Lê um ficheiro `snapshot.json` publicado por um coletor agendado (GitHub
 * Actions → branch `odds-cache`). A app NUNCA chama o The Odds API a partir do
 * browser neste modo — só faz GET a um ficheiro estático (grátis, sem créditos).
 * Assim o consumo de créditos é fixo (definido pelo cron do coletor) e a app
 * está sempre cheia de jogos, mesmo que a abras 100 vezes.
 *
 * Formato esperado:
 *   { "generatedAt": "2026-06-18T08:00:00Z", "snapshots": MarketSnapshot[] }
 * (também aceita um array de snapshots no topo, por robustez).
 */
import type { MarketSnapshot } from '../lib/types';
import type { OddsProvider, SnapshotListener } from './provider';

export interface SnapshotCacheConfig {
  url: string;
  /** Intervalo de releitura do ficheiro (default 300000 = 5 min). */
  pollMs?: number;
}

/** Extrai snapshots + generatedAt de um payload, tolerante a formatos. */
export function parseSnapshotPayload(raw: unknown): {
  generatedAt: number | null;
  snapshots: MarketSnapshot[];
} {
  if (Array.isArray(raw)) {
    return { generatedAt: null, snapshots: raw as MarketSnapshot[] };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as { generatedAt?: string | number; snapshots?: unknown };
    const snapshots = Array.isArray(o.snapshots) ? (o.snapshots as MarketSnapshot[]) : [];
    let generatedAt: number | null = null;
    if (typeof o.generatedAt === 'number') generatedAt = o.generatedAt;
    else if (typeof o.generatedAt === 'string') {
      const t = Date.parse(o.generatedAt);
      generatedAt = Number.isFinite(t) ? t : null;
    }
    return { generatedAt, snapshots };
  }
  return { generatedAt: null, snapshots: [] };
}

export class SnapshotCacheProvider implements OddsProvider {
  readonly name = 'Cache (servidor)';
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private config: SnapshotCacheConfig) {}

  subscribe(listener: SnapshotListener): () => void {
    const tick = async () => {
      try {
        const res = await fetch(this.config.url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { generatedAt, snapshots } = parseSnapshotPayload(await res.json());
        if (this.stopped) return;
        listener(snapshots, generatedAt != null ? { at: generatedAt } : undefined);
      } catch (e) {
        console.warn('[snapshot-cache] leitura falhou', e);
        if (!this.stopped) listener([]); // o store mantém o último lote bom
      }
    };
    void tick();
    this.timer = setInterval(() => void tick(), this.config.pollMs ?? 300000);
    return () => {
      this.stopped = true;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    };
  }
}
