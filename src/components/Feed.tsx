/**
 * Feed +EV ao vivo — o herói.
 * Denso, monospace, atualização incremental (sem piscar). Mostra por linha:
 * mercado | seleção | odd justa sharp | odd Betclic | odd 1xBet | melhor |
 * edge% | stake Kelly | detetado há Xs | apostar.
 */
import { Fragment, useState } from 'react';
import { useStore, selectFilteredFeed } from '../state/store';
import { useNow } from '../hooks/useNow';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BetDetail } from './BetDetail';
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
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  if (feed.length === 0) {
    return (
      <div className="table-wrap">
        <FeedStatus />
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

  // Telemóvel: cartões empilhados (sem scroll lateral).
  if (isMobile) {
    return (
      <div className="feed-cards">
        <FeedStatus />
        {feed.map((vb) => (
          <FeedCard
            key={vb.id}
            vb={vb}
            mov={movement[vb.id]}
            now={now}
            open={openId === vb.id}
            onToggle={() => toggle(vb.id)}
            onPlace={() => placeBet(vb)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <FeedStatus />
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
            <Fragment key={vb.id}>
              <FeedRow
                vb={vb}
                mov={movement[vb.id]}
                now={now}
                onToggle={() => toggle(vb.id)}
                onPlace={() => placeBet(vb)}
              />
              {openId === vb.id && (
                <tr className="detail-row">
                  <td colSpan={11}>
                    <BetDetail vb={vb} />
                  </td>
                </tr>
              )}
            </Fragment>
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
  onToggle,
  onPlace,
}: {
  vb: ValueBet;
  mov?: MovementInfo;
  now: number;
  onToggle: () => void;
  onPlace: () => void;
}) {
  const ageSec = Math.floor((now - new Date(vb.detectedAt).getTime()) / 1000);
  const fresh = ageSec < 6;
  const bookEdge = (book: TargetBook) => vb.books.find((b) => b.book === book);

  return (
    <tr className={`clickable ${fresh ? 'fresh' : ''}`} onClick={onToggle} title="Ver detalhe e análise">
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
        <span className="mono pos">{BOOK_META[vb.bestBook].label}</span>
        <br />
        <span className="pos">{odd(vb.bestOdd)}</span>
      </td>
      <td className={`edge-cell ${vb.bestEdge >= 0 ? 'pos' : 'neg'}`}>
        {vb.suspicious && <span title="edge suspeito (provável erro de odd)">⚠ </span>}
        {vb.reliability === 'baixa' && !vb.suspicious && (
          <span className="muted" title="baixa fiabilidade (1 sharp / sharps a divergir)">◦ </span>
        )}
        {signedPct(vb.bestEdge)}
      </td>
      <td className="hide-sm">{eur(vb.stake)}</td>
      <td className="hide-sm">
        <MovementCell mov={mov} />
      </td>
      <td className="hide-sm">
        <span className={`fresh-badge ${fresh ? 'hot' : ''}`}>{ago(vb.detectedAt, now)}</span>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
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

/** Aviso de estado dos dados: créditos esgotados ou cache antiga. */
function FeedStatus() {
  const snapAt = useStore((s) => s.snapAt);
  const credits = useStore((s) => s.credits);
  const now = useNow(30000);
  if (!snapAt) return null;

  const ageMin = Math.floor((now - snapAt) / 60000);
  const when = ageMin < 1 ? 'agora mesmo' : ageMin < 60 ? `há ${ageMin} min` : `há ${Math.floor(ageMin / 60)}h`;

  // Créditos esgotados (ou quase) → estamos a mostrar o último lote guardado.
  if (credits != null && credits <= 0) {
    return (
      <div className="note danger" style={{ marginBottom: 10 }}>
        Créditos do The Odds API esgotados (tier grátis = 500/mês, reseta no início do mês).
        A mostrar os últimos jogos guardados ({when}). Para mais agora: nova chave/plano nas Definições.
      </div>
    );
  }
  // Dados com mais de ~45 min → avisar que é cache à espera de novo varrimento.
  if (ageMin >= 45) {
    return (
      <div className="note" style={{ marginBottom: 10 }}>
        Dados de {when} (guardados). Novo varrimento em breve
        {credits != null ? ` · ${credits} créditos restantes` : ''}.
      </div>
    );
  }
  return null;
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

/** Cartão do feed para telemóvel — tudo vertical, sem scroll lateral. */
function FeedCard({
  vb,
  mov,
  now,
  open,
  onToggle,
  onPlace,
}: {
  vb: ValueBet;
  mov?: MovementInfo;
  now: number;
  open: boolean;
  onToggle: () => void;
  onPlace: () => void;
}) {
  const ageSec = Math.floor((now - new Date(vb.detectedAt).getTime()) / 1000);
  const fresh = ageSec < 6;
  const meta = BOOK_META[vb.bestBook];

  return (
    <div className={`vb-card ${fresh ? 'fresh' : ''} ${open ? 'open' : ''}`}>
      <div className="vb-card-top" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <div className="vb-card-event">
          <span className="market-chip">{marketLabel(vb.selection.market)}</span>
          <span className="teams">
            {vb.event.home} <span className="dim">v</span> {vb.event.away}
          </span>
          <span className="meta">
            {vb.event.league} · {shortTime(vb.event.startsAt)}
          </span>
        </div>
        <div className={`vb-card-edge ${vb.bestEdge >= 0 ? 'pos' : 'neg'}`}>
          {vb.suspicious && '⚠ '}
          {signedPct(vb.bestEdge)}
        </div>
      </div>

      <div className="vb-card-sel">{vb.selection.label}</div>

      <div className="vb-card-odds">
        <div className="vb-odd">
          <span className="k">Justa</span>
          <span className="neu mono">{odd(vb.fair.fairOdd)}</span>
        </div>
        {TARGETS.map((book) => {
          const be = vb.books.find((b) => b.book === book);
          const isBest = vb.bestBook === book && be?.isValue;
          return (
            <div className={`vb-odd ${isBest ? 'best' : ''}`} key={book}>
              <span className="k">{BOOK_META[book].label}</span>
              {be ? (
                <span className="mono">
                  <span className={isBest ? 'pos' : ''}>{odd(be.odd)}</span>{' '}
                  <span className={`e ${be.edge > 0 ? 'pos' : 'neg'}`}>{signedPct(be.edge)}</span>
                </span>
              ) : (
                <span className="dim">—</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="vb-card-foot">
        <span className="muted mono">
          Melhor <span className="pos">{meta.label} @ {odd(vb.bestOdd)}</span>
        </span>
        <span className="muted mono">Stake {eur(vb.stake)}</span>
      </div>
      <div className="vb-card-foot">
        <span className="mono">
          <MovementCell mov={mov} /> · <span className={fresh ? 'pos' : 'muted'}>{ago(vb.detectedAt, now)}</span>
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost" onClick={onToggle} title="Detalhe e análise">
            {open ? '▲' : 'análise ▾'}
          </button>
          <button className="btn primary" onClick={onPlace}>
            Apostar
          </button>
        </div>
      </div>

      {open && <BetDetail vb={vb} />}
    </div>
  );
}
