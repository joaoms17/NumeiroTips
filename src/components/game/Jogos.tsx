/** Jogos do dia + escolha do jogador (rotativo) + ajudas da roda. Mobile, animado. */
import { useEffect, useState, type CSSProperties } from 'react';
import { useGame, allPicks, dayList, matchesOfDay, myPick, mySpin, claimedInMatch, iWasRobbed } from '../../game/store';
import { isOpen, ratingOf, takenInMatch, usedByFriendOnDay, pickOrder } from '../../game/scoring';
import { FRIENDS } from '../../game/config';
import { ajudaMeta } from '../../game/wheel';
import { dayLabel, dayNum, kickLabel, relToday } from '../../game/format';
import type { Footballer, Match } from '../../game/types';
import { RodaBanner } from './Roda';

type HelpMode = 'second' | 'target' | 'steal';

export function Jogos() {
  const meId = useGame((s) => s.meId)!;
  const selectedDay = useGame((s) => s.selectedDay);
  const selectDay = useGame((s) => s.selectDay);
  const days = useGame(dayList);
  const matches = useGame((s) => matchesOfDay(s, selectedDay));
  const fixturesStatus = useGame((s) => s.fixturesStatus);

  if (days.length === 0) {
    return (
      <div className="rr-jogos">
        {fixturesStatus === 'loading' ? (
          <div className="rr-loading">
            <span className="rr-spinner" /> A carregar jogos do Mundial…
          </div>
        ) : (
          <div className="rr-empty rr-empty-big">
            😴 Sem jogos do Mundial nos próximos dias.
            <small>Os jogos aparecem aqui automaticamente quando houver.</small>
          </div>
        )}
      </div>
    );
  }

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

      <RodaBanner day={selectedDay} />

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
  const spinRec = useGame((s) => mySpin(s, match.day));
  const applyHelp = useGame((s) => s.applyHelp);
  const [picker, setPicker] = useState<null | 'pick' | HelpMode>(null);

  const robbed = useGame((s) => iWasRobbed(s, match.id));
  const picked = pick && !robbed ? findFootballer(match, pick.footballerId) : null;
  const earned = match.status === 'finished' && pick && !robbed ? ratingOf(match, pick.footballerId) : null;
  const order = pickOrder(FRIENDS, [match], match);

  const ajuda = spinRec && spinRec.ajuda !== 'nenhuma' ? ajudaMeta(spinRec.ajuda) : null;
  const helpUnused = !!ajuda && !spinRec!.matchId;
  const helpHere = spinRec?.matchId === match.id;

  const useHelpHere = () => {
    if (!ajuda) return;
    if (ajuda.needs === 'none') applyHelp(match.day, match.id);
    else setPicker(ajuda.needs);
  };

  return (
    <div className={`rr-card slide-up status-${match.status}`} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="rr-card-top">
        <span className="rr-stage">{match.stage}</span>
        <MatchState match={match} />
      </div>

      <div className="rr-teams">
        <Side flag={match.home.flag} name={match.home.name} goals={match.homeGoals} />
        <span className="rr-vs">{match.status === 'upcoming' ? kickLabel(match.kickoff) : '—'}</span>
        <Side flag={match.away.flag} name={match.away.name} goals={match.awayGoals} right />
      </div>

      <div className="rr-order">
        {order.map((f, i) => (
          <span key={f.id} className="rr-order-chip" style={{ '--c': f.color } as CSSProperties} title={`${i + 1}º a escolher`}>
            {f.emoji}
          </span>
        ))}
        <span className="rr-order-lbl muted">ordem de escolha</span>
      </div>

      {helpHere && (
        <div className="rr-help-here">{ajudaMeta(spinRec!.ajuda).emoji} ajuda aplicada aqui</div>
      )}

      {robbed && (
        <div className="rr-robbed">🕵️ Roubaram-te o jogador! {isOpen(match) ? 'Escolhe outro.' : ''}</div>
      )}

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
            <button className="rr-change" onClick={() => setPicker('pick')}>trocar</button>
          ) : (
            <span className="rr-lock">🔒</span>
          )}
        </div>
      ) : isOpen(match) ? (
        <button className="rr-choose" onClick={() => setPicker('pick')}>＋ Escolher jogador</button>
      ) : (
        <div className="rr-nopick muted">não escolheste 😬</div>
      )}

      {isOpen(match) && helpUnused && (
        <button className="rr-use-help" onClick={useHelpHere}>
          usar {ajuda!.emoji} {ajuda!.name} aqui
        </button>
      )}

      {picker && (
        <PlayerPicker
          match={match}
          meId={meId}
          picks={picks}
          mode={picker}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function PlayerPicker({
  match,
  meId,
  picks,
  mode,
  onClose,
}: {
  match: Match;
  meId: string;
  picks: ReturnType<typeof allPicks>;
  mode: 'pick' | HelpMode;
  onClose: () => void;
}) {
  const choose = useGame((s) => s.choose);
  const applyHelp = useGame((s) => s.applyHelp);
  const matches = useGame((s) => s.matches);
  const claimed = useGame((s) => claimedInMatch(s, match.id, meId)); // picks de outros + roubados
  const stealable = takenInMatch(picks, match.id, meId); // só dá para roubar picks de outros
  const usedToday = usedByFriendOnDay(picks, matches, meId, match.day, match.id);
  const [q, setQ] = useState('');

  const candidates = [...match.lineup.home, ...match.lineup.away].filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );

  const select = (f: Footballer) => {
    if (mode === 'pick') choose(match.id, f.id);
    else if (mode === 'second') applyHelp(match.day, match.id, { secondId: f.id });
    else applyHelp(match.day, match.id, { targetFootballerId: f.id }); // target / steal
    onClose();
  };

  const disabledFor = (f: Footballer): { dis: boolean; tag?: string } => {
    if (mode === 'pick') {
      if (claimed.has(f.id)) return { dis: true, tag: 'tomado' };
      if (usedToday.has(f.id)) return { dis: true, tag: 'usado hoje' };
      return { dis: false };
    }
    if (mode === 'steal') {
      // só dá para roubar jogadores já escolhidos por OUTROS neste jogo
      return stealable.has(f.id) ? { dis: false, tag: 'roubar' } : { dis: true };
    }
    return { dis: false }; // second / target: qualquer jogador
  };

  const title =
    mode === 'second' ? '⭐ Escolhe o 2º jogador'
    : mode === 'target' ? '😈 A quem tirar 2 pontos?'
    : mode === 'steal' ? '🕵️ Roubar qual jogador?'
    : 'Escolher jogador';

  return (
    <div className="rr-modal" onClick={onClose}>
      <div className="rr-sheet slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="rr-sheet-h">
          <span>{title}</span>
          <button className="rr-x" onClick={onClose}>✕</button>
        </div>
        {mode === 'target' && <div className="rr-blind muted">às cegas — não vês quem o escolheu</div>}
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
                  const { dis, tag } = disabledFor(p);
                  return (
                    <button
                      key={p.id}
                      className={`rr-pl-row ${dis ? 'dis' : ''}`}
                      disabled={dis}
                      onClick={() => select(p)}
                    >
                      <span className="rr-pos">{p.pos}</span>
                      <span className="rr-pl-name">{p.name}</span>
                      <span className="rr-pl-num">#{p.number}</span>
                      {tag && <span className={tag === 'tomado' ? 'rr-tag-taken' : tag === 'roubar' ? 'rr-tag-steal' : 'rr-tag-used'}>{tag}</span>}
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
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
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
