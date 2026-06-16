/**
 * Feed +EV ao vivo — o herói.
 * Denso, monospace, atualização incremental (sem piscar). Mostra por linha:
 * mercado | seleção | odd justa sharp | odd Betclic | odd 1xBet | melhor |
 * edge% | stake Kelly | detetado há Xs | apostar.
 */
import { useStore, selectFilteredFeed } from '../state/store';
import { useNow } from '../hooks/useNow';
import { BOOK_META } from '../lib/types';
import type { ValueBet, TargetBook } from '../lib/types';
import type { MovementInfo } from '../state/movement';
import { ago, eur, marketLabel, odd, prob, shortTime, signedPct } from '../lib/format';

const TARGETS: TargetBook[] = ['betclic', '1xbet'];

export function Feed() {
  const feed = useStore(selectFilteredFeed);
  const movement = useStore((s) => s.movement);
  const placeBet = useStore((s) => s.placeBet);
  const now = useNow(1000);

  if (feed.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty">
          <div style={{ fontSize: 28, marginBottom: 8 }}>⌁</div>
          Sem value bets a cumprir os filtros agora.
          <br />
          <span className="muted">
            O motor está a varrer o mercado — baixa o edge mínimo ou aguarda uma janela.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="l">Evento</th>
            <th className="l">Seleção</th>
            <th>Justa</th>
            <th>Betclic</th>
            <th>1xBet</th>
            <th>Melhor</th>
            <th>Edge</th>
            <th className="hide-sm">Kelly</th>
            <th className="hide-sm">Mov</th>
            <th className="hide-sm">Detetado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {feed.map((vb) => (
            <FeedRow
              key={vb.id}
              vb={vb}
              mov={movement[vb.id]}
              now={now}
              onPlace={() => placeBet(vb)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedRow({
  vb,
  mov,
  now,
  onPlace,
}: {
  vb: ValueBet;
  mov?: MovementInfo;
  now: number;
  onPlace: () => void;
}) {
  const ageSec = Math.floor((now - new Date(vb.detectedAt).getTime()) / 1000);
  const fresh = ageSec < 6;
  const bookEdge = (book: TargetBook) => vb.books.find((b) => b.book === book);

  return (
    <tr className={fresh ? 'fresh' : ''}>
      <td className="l">
        <div className="event-cell">
          <span className="teams">
            {vb.event.home} <span className="dim">v</span> {vb.event.away}
          </span>
          <span className="meta">
            {vb.event.league} · {shortTime(vb.event.startsAt)}
          </span>
        </div>
      </td>
      <td className="l">
        <span className="market-chip">{marketLabel(vb.selection.market)}</span>
        <span className="sel-cell">{vb.selection.label}</span>
      </td>
      <td title={`prob. justa ${prob(vb.fair.prob)} · ${vb.fair.method}`}>
        <span className="neu">{odd(vb.fair.fairOdd)}</span>
      </td>
      {TARGETS.map((book) => {
        const be = bookEdge(book);
        const isBest = vb.bestBook === book && be?.isValue;
        if (!be) {
          return (
            <td key={book}>
              <span className="dim">—</span>
            </td>
          );
        }
        return (
          <td key={book}>
            <span className={`book-odd ${isBest ? 'best' : ''}`}>
              <span className="o">{odd(be.odd)}</span>
              <span className={`e ${be.edge > 0 ? 'pos' : 'neg'}`}>{signedPct(be.edge)}</span>
            </span>
          </td>
        );
      })}
      <td>
        <span className="mono pos">
          {BOOK_META[vb.bestBook].label}
          <span className={`risk-tag ${BOOK_META[vb.bestBook].risk}`}>
            {BOOK_META[vb.bestBook].risk === 'cinzenta' ? 'cinzenta' : 'SRIJ'}
          </span>
        </span>
        <br />
        <span className="pos">{odd(vb.bestOdd)}</span>
      </td>
      <td className="edge-cell pos">{signedPct(vb.bestEdge)}</td>
      <td className="hide-sm">{eur(vb.stake)}</td>
      <td className="hide-sm">
        <MovementCell mov={mov} />
      </td>
      <td className="hide-sm">
        <span className={`fresh-badge ${fresh ? 'hot' : ''}`}>{ago(vb.detectedAt, now)}</span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <a
            className="btn ghost"
            href={vb.books.find((b) => b.book === vb.bestBook)?.deepLink ?? '#'}
            target="_blank"
            rel="noreferrer"
            title="Abrir boletim"
          >
            ↗
          </a>
          <button className="btn primary" onClick={onPlace} title="Registar aposta no tracker">
            Apostar
          </button>
        </div>
      </td>
    </tr>
  );
}

function MovementCell({ mov }: { mov?: MovementInfo }) {
  if (!mov || mov.dir === 'flat') return <span className="dim">—</span>;
  const arrow = mov.dir === 'up' ? '▲' : '▼';
  const cls = mov.dir === 'up' ? 'pos' : 'neg';
  return (
    <span className={cls} title={`prob. justa ${signedPct(mov.deltaProb)} na última janela`}>
      {mov.steam && <span title="steam: sharp move antes da casa reagir">⚡</span>} {arrow}{' '}
      {signedPct(mov.deltaProb)}
    </span>
  );
}
