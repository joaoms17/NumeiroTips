/** Jogos do dia + escolha do jogador (rotativo). Mobile, animado. */
import { useEffect, useState, type CSSProperties } from 'react';
import {
  useGame,
  allPicks,
  dayList,
  matchesOfDay,
  myPick,
} from '../../game/store';
import {
  isOpen,
  ratingOf,
  takenInMatch,
  usedByFriendOnDay,
  pickOrder,
} from '../../game/scoring';
import { FRIENDS } from '../../game/config';
import { dayLabel, dayNum, kickLabel, relToday } from '../../game/format';
import type { Footballer, Match } from '../../game/types';

export function Jogos() {
  const meId = useGame((s) => s.meId)!;
  const selectedDay = useGame((s) => s.selectedDay);
  const selectDay = useGame((s) => s.selectDay);
  const days = useGame(dayList);
  const matches = useGame((s) => matchesOfDay(s, selectedDay));

  return (
    <div className="rr-jogos">
      <div className="rr-daybar">
        {days.map((d) => {
          const rel = relToday(d);
          return (
            <button
              key={d}
              className={`rr-day ${d === selectedDay ? 'active' : ''}`}
              onClick={() => selectDay(d)}
            >
              <span className="rr-day-num">{dayNum(d)}</span>
              <span className="rr-day-lbl">{rel ?? dayLabel(d).split(',')[0]}</span>
            </button>
          );
        })}
      </div>

      <div className="rr-day-title">{dayLabel(selectedDay)}</div>

      <div className="rr-cards">
        {matches.map((m, i) => (
          <MatchCard key={m.id} match={m} meId={meId} index={i} />
        ))}
        {matches.length === 0 && <div className="rr-empty">Sem jogos neste dia.</div>}
      </div>
    </div>
  );
}

function MatchCard({ match, meId, index }: { match: Match; meId: string; index: number }) {
  const pick = useGame((s) => myPick(s, match.id));
  const picks = useGame(allPicks);
  const [open, setOpen] = useState(false);

  const picked = pick ? findFootballer(match, pick.footballerId) : null;
  const earned = match.status === 'finished' && pick ? ratingOf(match, pick.footballerId) : null;
  const order = pickOrder(FRIENDS, [match], match);

  return (
    <div
      className={`rr-card slide-up status-${match.status}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="rr-card-top">
        <span className="rr-stage">{match.stage}</span>
        <MatchState match={match} />
      </div>

      <div className="rr-teams">
        <Side flag={match.home.flag} name={match.home.name} goals={match.homeGoals} />
        <span className="rr-vs">{match.status === 'upcoming' ? kickLabel(match.kickoff) : '—'}</span>
        <Side flag={match.away.flag} name={match.away.name} goals={match.awayGoals} right />
      </div>

      {/* fila rotativa de escolha */}
      <div className="rr-order">
        {order.map((f, i) => (
          <span key={f.id} className="rr-order-chip" style={{ '--c': f.color } as CSSProperties} title={`${i + 1}º a escolher`}>
            {f.emoji}
          </span>
        ))}
        <span className="rr-order-lbl muted">ordem de escolha</span>
      </div>

      {/* a minha escolha */}
      {picked ? (
        <div className={`rr-mypick ${earned != null ? 'scored pop' : ''}`}>
          <div className="rr-mypick-info">
            <span className="rr-pos">{picked.pos}</span>
            <span className="rr-pl-name">{picked.name}</span>
            <span className="rr-pl-team">{teamFlag(match, picked.team)}</span>
          </div>
          {earned != null ? (
            <span className="rr-earned"><CountUp value={earned} /> <small>pts</small></span>
          ) : isOpen(match) ? (
            <button className="rr-change" onClick={() => setOpen(true)}>trocar</button>
          ) : (
            <span className="rr-lock">🔒</span>
          )}
        </div>
      ) : isOpen(match) ? (
        <button className="rr-choose" onClick={() => setOpen(true)}>
          ＋ Escolher jogador
        </button>
      ) : (
        <div className="rr-nopick muted">não escolheste 😬</div>
      )}

      {open && (
        <PlayerPicker
          match={match}
          meId={meId}
          picks={picks}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function PlayerPicker({
  match,
  meId,
  picks,
  onClose,
}: {
  match: Match;
  meId: string;
  picks: ReturnType<typeof allPicks>;
  onClose: () => void;
}) {
  const choose = useGame((s) => s.choose);
  const matches = useGame((s) => s.matches);
  const taken = takenInMatch(picks, match.id, meId);
  const usedToday = usedByFriendOnDay(picks, matches, meId, match.day, match.id);
  const [q, setQ] = useState('');

  const candidates = [...match.lineup.home, ...match.lineup.away].filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );

  const pick = (f: Footballer) => {
    choose(match.id, f.id);
    onClose();
  };

  return (
    <div className="rr-modal" onClick={onClose}>
      <div className="rr-sheet slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="rr-sheet-h">
          <span>{match.home.flag} {match.home.name} <small>vs</small> {match.away.name} {match.away.flag}</span>
          <button className="rr-x" onClick={onClose}>✕</button>
        </div>
        <input
          className="rr-search"
          placeholder="Procurar jogador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="rr-pl-list">
          {[match.home, match.away].map((team) => (
            <div key={team.code}>
              <div className="rr-pl-group">{team.flag} {team.name}</div>
              {candidates
                .filter((p) => p.team === team.code)
                .map((p) => {
                  const isTaken = taken.has(p.id);
                  const isUsed = usedToday.has(p.id);
                  const dis = isTaken || isUsed;
                  return (
                    <button
                      key={p.id}
                      className={`rr-pl-row ${dis ? 'dis' : ''}`}
                      disabled={dis}
                      onClick={() => pick(p)}
                    >
                      <span className="rr-pos">{p.pos}</span>
                      <span className="rr-pl-name">{p.name}</span>
                      <span className="rr-pl-num">#{p.number}</span>
                      {isTaken && <span className="rr-tag-taken">tomado</span>}
                      {isUsed && !isTaken && <span className="rr-tag-used">usado hoje</span>}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Side({ flag, name, goals, right }: { flag: string; name: string; goals?: number; right?: boolean }) {
  return (
    <div className={`rr-side ${right ? 'right' : ''}`}>
      <span className="rr-flag">{flag}</span>
      <span className="rr-team-name">{name}</span>
      {goals != null && <span className="rr-goals">{goals}</span>}
    </div>
  );
}

function MatchState({ match }: { match: Match }) {
  if (match.status === 'live')
    return <span className="rr-live"><span className="rr-live-dot" /> {match.minute}'</span>;
  if (match.status === 'finished') return <span className="rr-ft">Final</span>;
  const rel = relToday(match.day);
  return <span className="rr-soon">{rel === 'hoje' ? kickLabel(match.kickoff) : '—'}</span>;
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setN(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{n.toFixed(1)}</span>;
}

function findFootballer(match: Match, id: string): Footballer | null {
  return [...match.lineup.home, ...match.lineup.away].find((p) => p.id === id) ?? null;
}
function teamFlag(match: Match, code: string): string {
  return match.home.code === code ? match.home.flag : match.away.flag;
}
