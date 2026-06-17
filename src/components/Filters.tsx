/** Filtros do feed: desporto, mercado, edge mínimo, odd mínima, casa, pesquisa. */
import { useStore } from '../state/store';
import type { MarketType, TargetBook } from '../lib/types';
import { marketLabel } from '../lib/format';

const MARKETS: Array<MarketType | 'all'> = ['all', '1x2', 'over_under', 'ah', 'btts'];
const BOOKS: Array<TargetBook | 'all'> = ['all', 'betclic', '1xbet'];

export function Filters() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

  return (
    <div className="filters">
      <div className="field">
        <label htmlFor="f-search">Pesquisa</label>
        <input
          id="f-search"
          placeholder="equipa, liga…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          style={{ width: 160 }}
        />
      </div>

      <div className="field">
        <label htmlFor="f-market">Mercado</label>
        <select
          id="f-market"
          value={filters.market}
          onChange={(e) => setFilters({ market: e.target.value as MarketType | 'all' })}
        >
          {MARKETS.map((m) => (
            <option key={m} value={m}>
              {marketLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-book">Casa</label>
        <select
          id="f-book"
          value={filters.book}
          onChange={(e) => setFilters({ book: e.target.value as TargetBook | 'all' })}
        >
          {BOOKS.map((b) => (
            <option key={b} value={b}>
              {b === 'all' ? 'Todas' : b === 'betclic' ? 'Betclic' : '1xBet'}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-edge">
          Edge mín · {filters.minEdge > 0 ? '+' : ''}
          {(filters.minEdge * 100).toFixed(1)}%
        </label>
        <input
          id="f-edge"
          type="range"
          min={-0.1}
          max={0.1}
          step={0.005}
          value={filters.minEdge}
          onChange={(e) => setFilters({ minEdge: Number(e.target.value) })}
          style={{ width: 140 }}
        />
      </div>

      <div className="field">
        <label htmlFor="f-odd">Odd mín</label>
        <input
          id="f-odd"
          type="number"
          min={1}
          step={0.1}
          value={filters.minOdd}
          onChange={(e) => setFilters({ minOdd: Number(e.target.value) || 1 })}
          style={{ width: 72 }}
        />
      </div>

      <div className="field">
        <label htmlFor="f-oddmax">Odd máx</label>
        <input
          id="f-oddmax"
          type="number"
          min={0}
          step={0.5}
          placeholder="sem limite"
          value={filters.maxOdd || ''}
          onChange={(e) => setFilters({ maxOdd: Number(e.target.value) || 0 })}
          style={{ width: 84 }}
        />
      </div>

      <div className="field">
        <label htmlFor="f-window">Janela</label>
        <select
          id="f-window"
          value={filters.withinHours}
          onChange={(e) => setFilters({ withinHours: Number(e.target.value) })}
        >
          <option value={0}>Qualquer altura</option>
          <option value={3}>Próximas 3h</option>
          <option value={6}>Próximas 6h</option>
          <option value={12}>Próximas 12h</option>
          <option value={24}>Próximas 24h</option>
          <option value={48}>Próximas 48h</option>
        </select>
      </div>
    </div>
  );
}
