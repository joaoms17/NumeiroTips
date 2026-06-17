/**
 * Detalhe de uma value bet — o posto de decisão por jogo:
 * matemática (justo vs casa, edge, Kelly), links de estatísticas externas do
 * jogo REAL (FlashScore/ZeroZero/SofaScore) e um campo de análise pessoal.
 */
import { useStore } from '../state/store';
import { useLocalNote } from '../hooks/useLocalNote';
import { matchExternalLinks } from '../lib/externalStats';
import { BOOK_META } from '../lib/types';
import type { ValueBet } from '../lib/types';
import { eur, odd as fmtOdd, prob, signedPct } from '../lib/format';

export function BetDetail({ vb }: { vb: ValueBet }) {
  const placeBet = useStore((s) => s.placeBet);
  const [note, setNote] = useLocalNote(vb.event.id);
  const links = matchExternalLinks(vb.event.home, vb.event.away);

  return (
    <div className="bet-detail">
      <div className="grid-2" style={{ gap: 12 }}>
        <div>
          <div className="detail-title">Matemática</div>
          <DetRow k="Prob. justa (sharp)" v={prob(vb.fair.prob)} />
          <DetRow k="Odd justa" v={fmtOdd(vb.fair.fairOdd)} />
          {vb.books.map((b) => (
            <DetRow
              key={b.book}
              k={`${BOOK_META[b.book].label} ${b.book === vb.bestBook ? '★' : ''}`}
              v={`${fmtOdd(b.odd)} · ${signedPct(b.edge)}`}
              cls={b.edge > 0 ? 'pos' : 'neg'}
            />
          ))}
          <DetRow k="Stake Kelly sugerido" v={eur(vb.stake)} cls="pos" />
        </div>

        <div>
          <div className="detail-title">Estatísticas do jogo (externo)</div>
          <div className="link-row">
            {links.map((l) => (
              <a key={l.name} className="btn ghost" href={l.url} target="_blank" rel="noreferrer">
                {l.name} ↗
              </a>
            ))}
          </div>

          <div className="detail-title" style={{ marginTop: 12 }}>A minha análise</div>
          <textarea
            className="analysis-note"
            placeholder="A tua leitura do jogo: lesões, motivação, forma, porque tem valor…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      <div className="detail-actions">
        <a
          className="btn"
          href={vb.books.find((b) => b.book === vb.bestBook)?.deepLink ?? '#'}
          target="_blank"
          rel="noreferrer"
        >
          Abrir boletim {BOOK_META[vb.bestBook].label} ↗
        </a>
        <button className="btn primary" onClick={() => placeBet(vb)}>
          Registar aposta
        </button>
      </div>
    </div>
  );
}

function DetRow({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="calc-row">
      <span className="lbl">{k}</span>
      <span className={`val mono ${cls ?? ''}`}>{v}</span>
    </div>
  );
}
