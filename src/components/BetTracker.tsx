/**
 * Bet tracker: lista de apostas registadas, liquidação, P/L, ROI e CLV.
 * Ao liquidar pode introduzir-se a odd justa de fecho sharp → calcula CLV.
 */
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { ACCOUNT_BOOK_META, ACCOUNT_BOOKS } from '../lib/types';
import type { AccountBook, BetResult, TrackedBet } from '../lib/types';
import { eur, signedPct, odd as fmtOdd } from '../lib/format';

function ManualBetForm() {
  const addManualBet = useStore((s) => s.addManualBet);
  const [label, setLabel] = useState('');
  const [book, setBook] = useState<AccountBook>('betano');
  const [stake, setStake] = useState(5);
  const [oddV, setOddV] = useState(2.0);
  const [fairOdd, setFairOdd] = useState('');

  const submit = () => {
    if (!(oddV > 1) || stake <= 0) return;
    addManualBet({
      label,
      book,
      stake,
      odd: oddV,
      fairOdd: fairOdd ? Number(fairOdd) : undefined,
    });
    setLabel('');
  };

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-h">Registar aposta (qualquer casa)</div>
      <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field">
          <label>Descrição</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Benfica v Porto — Casa" style={{ width: 200 }} />
        </div>
        <div className="field">
          <label>Casa</label>
          <select value={book} onChange={(e) => setBook(e.target.value as AccountBook)}>
            {ACCOUNT_BOOKS.map((b) => (
              <option key={b} value={b}>
                {ACCOUNT_BOOK_META[b].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Stake €</label>
          <input type="number" min={0} step={0.5} value={stake} onChange={(e) => setStake(Number(e.target.value) || 0)} style={{ width: 80 }} />
        </div>
        <div className="field">
          <label>Odd</label>
          <input type="number" min={1.01} step={0.01} value={oddV} onChange={(e) => setOddV(Number(e.target.value) || 1.01)} style={{ width: 80 }} />
        </div>
        <div className="field">
          <label>Odd justa (op.)</label>
          <input type="number" min={1.01} step={0.01} value={fairOdd} onChange={(e) => setFairOdd(e.target.value)} placeholder="—" style={{ width: 80 }} />
        </div>
        <button className="btn primary" onClick={submit}>Registar</button>
      </div>
    </div>
  );
}

export function BetTracker() {
  const bets = useStore((s) => s.bets);

  const stats = useMemo(() => {
    const settled = bets.filter((b) => b.result !== 'pending');
    const staked = settled.reduce((s, b) => s + b.stake, 0);
    const pnl = settled.reduce((s, b) => s + (b.pnl ?? 0), 0);
    const roi = staked > 0 ? pnl / staked : 0;
    const withClv = bets.filter((b) => b.clv != null);
    const avgClv =
      withClv.length > 0 ? withClv.reduce((s, b) => s + (b.clv ?? 0), 0) / withClv.length : 0;
    const wins = settled.filter((b) => b.result === 'won').length;
    const hitRate = settled.length > 0 ? wins / settled.length : 0;
    return { staked, pnl, roi, avgClv, hitRate, settledCount: settled.length };
  }, [bets]);

  return (
    <div>
      <ManualBetForm />
      <div className="grid-3">
        <Stat k="P/L liquidado" v={eur(stats.pnl)} cls={stats.pnl >= 0 ? 'pos' : 'neg'} />
        <Stat
          k="ROI"
          v={signedPct(stats.roi, 1)}
          cls={stats.roi >= 0 ? 'pos' : 'neg'}
        />
        <Stat
          k="CLV médio"
          v={signedPct(stats.avgClv, 2)}
          cls={stats.avgClv >= 0 ? 'pos' : 'neg'}
        />
      </div>

      <div className="section-title">
        Apostas registadas ({bets.length}) · {stats.settledCount} liquidadas
      </div>

      {bets.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">
            Ainda não registaste apostas. Carrega em <b>Apostar</b> numa linha do feed.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="l">Aposta</th>
                <th>Casa</th>
                <th>Stake</th>
                <th>Odd</th>
                <th>Edge</th>
                <th>Estado</th>
                <th>P/L</th>
                <th>CLV</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => (
                <BetRow key={b.id} bet={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note">
        CLV (closing line value) = odd_apostada / odd_justa_de_fecho − 1. Ao liquidar, introduz a
        odd justa de fecho sharp para medir se bateste a linha — é o melhor indicador de lucro a
        longo prazo.
      </div>
    </div>
  );
}

function BetRow({ bet }: { bet: TrackedBet }) {
  const settleBet = useStore((s) => s.settleBet);
  const removeBet = useStore((s) => s.removeBet);
  const [closing, setClosing] = useState<string>('');

  const settle = (result: BetResult) => {
    const fairClosing = closing ? Number(closing) : undefined;
    settleBet(bet.id, result, fairClosing);
  };

  return (
    <tr>
      <td className="l">
        <span className="sel-cell">{bet.label}</span>
      </td>
      <td>
        <span className="mono">{ACCOUNT_BOOK_META[bet.book].label}</span>
      </td>
      <td>{eur(bet.stake)}</td>
      <td>{fmtOdd(bet.odd)}</td>
      <td className={bet.edgeAtBet >= 0 ? 'pos' : 'neg'}>{signedPct(bet.edgeAtBet)}</td>
      <td>
        <StateTag result={bet.result} />
      </td>
      <td className={bet.pnl == null ? 'dim' : bet.pnl >= 0 ? 'pos' : 'neg'}>
        {bet.pnl == null ? '—' : eur(bet.pnl)}
      </td>
      <td className={bet.clv == null ? 'dim' : bet.clv >= 0 ? 'pos' : 'neg'}>
        {bet.clv == null ? '—' : signedPct(bet.clv)}
      </td>
      <td>
        {bet.result === 'pending' ? (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
            <input
              placeholder="fecho"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              title="Odd justa de fecho sharp (para CLV)"
              style={{ width: 64 }}
            />
            <button className="btn" onClick={() => settle('won')} title="Ganhou">
              ✓
            </button>
            <button className="btn danger" onClick={() => settle('lost')} title="Perdeu">
              ✗
            </button>
            <button className="btn ghost" onClick={() => settle('void')} title="Anulada">
              ∅
            </button>
          </div>
        ) : (
          <button className="btn ghost" onClick={() => removeBet(bet.id)} title="Remover">
            🗑
          </button>
        )}
      </td>
    </tr>
  );
}

function StateTag({ result }: { result: BetResult }) {
  const map: Record<BetResult, { t: string; c: string }> = {
    pending: { t: 'pendente', c: 'neu' },
    won: { t: 'ganhou', c: 'pos' },
    lost: { t: 'perdeu', c: 'neg' },
    void: { t: 'anulada', c: 'muted' },
    cashout: { t: 'cashout', c: 'neu' },
  };
  const { t, c } = map[result];
  return <span className={`mono ${c}`}>{t}</span>;
}

function Stat({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className={`v ${cls ?? ''}`}>{v}</div>
    </div>
  );
}
