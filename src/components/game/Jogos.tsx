/** Jogos do dia + escolha do jogador (rotativo) + ajudas da roda. Mobile, animado. */
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGame, allPicks, allSpins, dayList, matchesOfDay, myPrefs, mySpin, resolvedForMatch, submittedFriends } from '../../game/store';
import { isOpen, hasStarted, matchPhase, prefsOf, MAX_PREFS } from '../../game/scoring';
import { FRIENDS } from '../../game/config';
import { ajudaMeta } from '../../game/wheel';
import { dayLabel, dayNum, kickLabel, relToday } from '../../game/format';
import type { Footballer, Match, NationTeam, ResolvedPick } from '../../game/types';
import { RodaBanner } from './Roda';
import { Flag } from './Flag';

type HelpMode = 'target';

export function Jogos() {
  const meId = useGame((s) => s.meId)!;
  const selectedDay = useGame((s) => s.selectedDay);
  const selectDay = useGame((s) => s.selectDay);
  const days = useGame(dayList);
  const matches = useGame((s) => matchesOfDay(s, selectedDay));
  const fixturesStatus = useGame((s) => s.fixturesStatus);
  const refreshFixtures = useGame((s) => s.refreshFixtures);
  const isAdmin = meId === 'joao';
  const refreshing = fixturesStatus === 'loading';
  const [importing, setImporting] = useState(false);
  // re-render periódico para os jogos "fecharem" e revelarem ao passar a hora
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

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

      <div className="rr-day-head">
        <span className="rr-day-title">{dayLabel(selectedDay)}</span>
        {isAdmin && (
          <div className="rr-admin-actions">
            <button className="rr-refresh" onClick={() => setImporting(true)} title="Importar onze/notas (admin)">
              ✏️ dados
            </button>
            <button className="rr-refresh" onClick={refreshFixtures} disabled={refreshing} title="Forçar atualização (admin)">
              {refreshing ? <span className="rr-spinner sm" /> : '🔄'} atualizar
            </button>
          </div>
        )}
      </div>

      {importing && <AdminImport onClose={() => setImporting(false)} />}

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
  const prefs = useGame((s) => myPrefs(s, match.id));
  const submitted = useGame((s) => submittedFriends(s, match.id));
  const spinRec = useGame((s) => mySpin(s, match.day));
  const applyHelp = useGame((s) => s.applyHelp);
  const [picker, setPicker] = useState<null | 'pick' | HelpMode>(null);

  const started = hasStarted(match); // hora passou ou já live/finished
  const open = isOpen(match) && !started; // ainda dá para submeter

  const ajuda = spinRec && spinRec.ajuda !== 'nenhuma' ? ajudaMeta(spinRec.ajuda) : null;
  const helpUnused = !!ajuda && !spinRec!.matchId;
  const helpHere = spinRec?.matchId === match.id;

  const useHelpHere = () => {
    if (!ajuda) return;
    if (ajuda.needs === 'target') setPicker('target'); // tira → alvo
    else applyHelp(match.day, match.id); // rede / dois / roubo (sem alvo)
  };

  const prefNames = prefs.map((id) => findFootballer(match, id)).filter(Boolean) as Footballer[];

  return (
    <div className={`rr-card slide-up status-${match.status}`} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="rr-card-top">
        <span className="rr-stage">
          {match.stage}
          {match.lineupConfirmed && <span className="rr-lineup-badge" title="Onze oficial já anunciado">✅ onze oficial</span>}
        </span>
        <MatchState match={match} />
      </div>

      <div className="rr-teams">
        <Side team={match.home} goals={match.homeGoals} />
        <span className="rr-vs">{!started ? kickLabel(match.kickoff) : '—'}</span>
        <Side team={match.away} goals={match.awayGoals} right />
      </div>

      {!started && (
        <div className="rr-order">
          {FRIENDS.map((f) => (
            <span
              key={f.id}
              className={`rr-order-chip ${submitted.has(f.id) ? 'done' : ''}`}
              style={{ '--c': f.color } as CSSProperties}
              title={`${f.name} — ${submitted.has(f.id) ? 'já submeteu' : 'ainda não'}`}
            >
              {f.initials}
            </span>
          ))}
          <span className="rr-order-lbl muted">já submeteram (às cegas)</span>
        </div>
      )}

      {helpHere && (
        <div className="rr-help-here">{ajudaMeta(spinRec!.ajuda).emoji} ajuda aplicada aqui</div>
      )}

      {started ? (
        <RevealPicks match={match} meId={meId} />
      ) : prefNames.length > 0 ? (
        <div className="rr-myprefs">
          <ol className="rr-myprefs-list">
            {prefNames.map((p) => (
              <li key={p.id}>
                <span className="rr-pl-name">{p.name}</span>
                <span className="rr-pl-team"><Flag cc={teamByCode(match, p.team).cc} flag={teamByCode(match, p.team).flag} name={p.team} /></span>
              </li>
            ))}
          </ol>
          <button className="rr-change" onClick={() => setPicker('pick')}>editar preferências</button>
        </div>
      ) : (
        <button className="rr-choose" onClick={() => setPicker('pick')}>＋ Escolher preferências (até {MAX_PREFS})</button>
      )}

      {open && helpUnused && (
        <button className="rr-use-help" onClick={useHelpHere}>
          usar {ajuda!.emoji} {ajuda!.name} aqui
        </button>
      )}

      {picker && (
        <PlayerPicker
          match={match}
          mode={picker}
          initialPrefs={prefs}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function PlayerPicker({
  match,
  mode,
  initialPrefs,
  onClose,
}: {
  match: Match;
  mode: 'pick' | HelpMode;
  initialPrefs: string[];
  onClose: () => void;
}) {
  const submitPrefs = useGame((s) => s.submitPrefs);
  const applyHelp = useGame((s) => s.applyHelp);
  const [ordered, setOrdered] = useState<string[]>(initialPrefs);
  const [q, setQ] = useState('');

  const starters = new Set(match.starters ?? []);
  const candidates = [...match.lineup.home, ...match.lineup.away].filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );
  // titulares primeiro (quando o onze já foi importado)
  const byTeam = (code: string) =>
    candidates
      .filter((p) => p.team === code)
      .sort((a, b) => Number(starters.has(b.id)) - Number(starters.has(a.id)));

  const rankOf = (id: string) => ordered.indexOf(id); // -1 se não escolhido

  const toggle = (f: Footballer) => {
    if (mode !== 'pick') {
      applyHelp(match.day, match.id, { targetFootballerId: f.id }); // tira → alvo
      onClose();
      return;
    }
    setOrdered((cur) => {
      if (cur.includes(f.id)) return cur.filter((x) => x !== f.id); // remover
      if (cur.length >= MAX_PREFS) return cur; // já cheio
      return [...cur, f.id]; // acrescentar ao fim (próxima preferência)
    });
  };

  const save = () => {
    if (ordered.length === 0) { onClose(); return; }
    submitPrefs(match.id, ordered);
    onClose();
  };

  const title = mode === 'target'
    ? '😈 A quem tirar 2 pontos?'
    : `Preferências (até ${MAX_PREFS}, por ordem)`;

  return createPortal(
    <div className="rr-modal" onClick={onClose}>
      <div className="rr-sheet slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="rr-sheet-h">
          <span>{title}</span>
          <button className="rr-x" onClick={onClose}>✕</button>
        </div>
        {mode === 'target'
          ? <div className="rr-blind muted">às cegas — não vês quem o escolheu</div>
          : <div className="rr-blind muted">toca pela ordem que preferes — ao apito fica o 1º que estiver livre</div>}
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
              <div className="rr-pl-group">
                <Flag cc={team.cc} flag={team.flag} name={team.name} /> {team.name}
                {match.lineupConfirmed && starters.size > 0 && <span className="rr-pl-group-xi">onze oficial ✅</span>}
              </div>
              {byTeam(team.code).map((p) => {
                const rank = mode === 'pick' ? rankOf(p.id) : -1;
                const isStarter = starters.has(p.id);
                const full = mode === 'pick' && rank < 0 && ordered.length >= MAX_PREFS;
                return (
                  <button
                    key={p.id}
                    className={`rr-pl-row ${isStarter ? 'starter' : ''} ${rank >= 0 ? 'picked' : ''} ${full ? 'dis' : ''}`}
                    disabled={full}
                    onClick={() => toggle(p)}
                  >
                    {rank >= 0 && <span className="rr-pl-rank">{rank + 1}</span>}
                    <span className="rr-pl-name">{p.name}</span>
                    {isStarter && <span className="rr-tag-start">titular</span>}
                    <span className="rr-pl-num">#{p.number}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {mode === 'pick' && (
          <button className="rr-admin-save" onClick={save} disabled={ordered.length === 0}>
            Guardar{ordered.length > 0 ? ` (${ordered.length})` : ''}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Side({ team, goals, right }: { team: NationTeam; goals?: number; right?: boolean }) {
  return (
    <div className={`rr-side ${right ? 'right' : ''}`}>
      <span className="rr-flag"><Flag cc={team.cc} flag={team.flag} name={team.name} /></span>
      <span className="rr-team-name">{team.name}</span>
      {goals != null && <span className="rr-goals">{goals}</span>}
    </div>
  );
}

function MatchState({ match }: { match: Match }) {
  const phase = matchPhase(match);
  if (phase === 'live')
    return <span className="rr-live"><span className="rr-live-dot" /> {match.minute ? `${match.minute}'` : 'a decorrer'}</span>;
  if (phase === 'finished') return <span className="rr-ft">Final</span>;
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
function teamByCode(match: Match, code: string): NationTeam {
  return match.home.code === code ? match.home : match.away;
}

/** Revela a escolha de cada amigo (depois do jogo começar). */
function RevealPicks({ match, meId }: { match: Match; meId: string }) {
  const finished = matchPhase(match) === 'finished';
  const spins = useGame(allSpins);
  const resolved = useGame((s) => resolvedForMatch(s, match.id));
  const spinList = Object.entries(spins);
  const byFriend = new Map<string, ResolvedPick>(resolved.map((r) => [r.friendId, r]));
  return (
    <div className="rr-reveal">
      <div className="rr-reveal-h">
        🔓 Escolhas de cada um
        <span className={`rr-reveal-tag ${finished ? 'final' : 'live'}`}>
          {finished ? 'notas definitivas' : 'notas provisórias'}
        </span>
      </div>
      {FRIENDS.map((f) => {
        const rp = byFriend.get(f.id);
        const fb = rp?.footballerId ? findFootballer(match, rp.footballerId) : null;
        const rating = fb ? (match.ratings?.[fb.id] ?? null) : null;
        const spin = spins[`${f.id}|${match.day}`];
        const ajuda = spin?.matchId === match.id && spin.ajuda !== 'nenhuma' ? ajudaMeta(spin.ajuda) : null;

        // Dois: 2º jogador (resolvido — a preferência seguinte disponível)
        const doisFb = rp?.secondId ? findFootballer(match, rp.secondId) : null;
        const doisRating = doisFb ? (match.ratings?.[doisFb.id] ?? null) : null;
        const doisWinner = doisFb && doisRating != null && rating != null
          ? (doisRating >= rating ? 'second' : 'first')
          : doisFb ? 'second' : 'first';
        const effectiveRating = doisFb
          ? Math.max(rating ?? 0, doisRating ?? 0)
          : rating;

        // Tira-2: algum spin tira o jogador deste amigo neste jogo?
        const tiraed = fb
          ? spinList.some(([, s]) => s.ajuda === 'tira' && s.matchId === match.id && s.targetFootballerId === fb.id)
          : false;
        const displayRating = tiraed && effectiveRating != null ? Math.max(0, effectiveRating - 2) : effectiveRating;

        return (
          <div key={f.id} className={`rr-reveal-row ${f.id === meId ? 'me' : ''}`}>
            <span className="rr-reveal-chip" style={{ '--c': f.color } as CSSProperties}>{f.initials}</span>
            <div className="rr-reveal-body">
              {fb ? (
                <div className="rr-reveal-main">
                  <span className={`rr-reveal-name ${doisFb && doisWinner === 'second' ? 'muted' : ''}`}>
                    {doisFb && doisWinner === 'first' && <span className="rr-star">⭐</span>}{fb.name}
                  </span>
                  <span className="rr-reveal-team">
                    <Flag cc={teamByCode(match, fb.team).cc} flag={teamByCode(match, fb.team).flag} name={fb.team} />
                  </span>
                </div>
              ) : (
                <div className="rr-reveal-main"><span className="rr-reveal-name muted">não escolheu 😬</span></div>
              )}
              {doisFb && (
                <div className="rr-reveal-second">
                  <span className={`rr-reveal-name ${doisWinner === 'first' ? 'muted' : ''}`}>
                    {doisWinner === 'second' && <span className="rr-star">⭐</span>}{doisFb.name}
                  </span>
                  <span className="rr-reveal-team">
                    <Flag cc={teamByCode(match, doisFb.team).cc} flag={teamByCode(match, doisFb.team).flag} name={doisFb.team} />
                  </span>
                </div>
              )}
            </div>
            {ajuda && <span className="rr-reveal-ajuda" title={ajuda.name}>{ajuda.emoji}</span>}
            {displayRating != null && displayRating > 0 && (
              <div className="rr-reveal-score">
                {tiraed && effectiveRating != null && (
                  <span className="rr-score-struck">{effectiveRating.toFixed(1)}</span>
                )}
                <span className={`rr-reveal-rating ${finished ? 'final' : 'live'}`}>
                  <CountUp value={displayRating} />
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Reduz uma imagem e devolve base64 JPEG (sem prefixo), p/ enviar à visão AI. */
async function fileToJpegBase64(file: File, maxW = 1280): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxW / (img.width || maxW));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

interface VisionPlayer { side?: string; number?: number | null; name?: string; rating?: number | null; starter?: boolean }

interface ReviewItem {
  raw: string;             // nome lido na imagem
  side: 'home' | 'away';
  rating: number | null;
  starter: boolean;
  id: string;              // id do jogador na app ('' = ignorar / por confirmar)
  auto: boolean;           // reconhecido automaticamente?
}

function normName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Casa um nome lido com um jogador do plantel — só devolve matches CONFIANTES. */
function matchByName(name: string, pool: Footballer[]): Footballer | null {
  const n = normName(name);
  if (!n) return null;
  const exact = pool.filter((p) => normName(p.name) === n);
  if (exact.length === 1) return exact[0];
  const surname = n.split(' ').slice(-1)[0];
  const bySurname = pool.filter((p) => normName(p.name).split(' ').includes(surname));
  if (bySurname.length === 1) return bySurname[0];
  const contains = pool.filter((p) => { const pn = normName(p.name); return pn.includes(n) || n.includes(pn); });
  if (contains.length === 1) return contains[0];
  return null; // ambíguo → o admin decide
}

/** Painel admin: importa onze + notas por IMAGEM (visão AI), mapeando por NOME. */
function AdminImport({ onClose }: { onClose: () => void }) {
  const savePatch = useGame((s) => s.savePatch);
  const setFlash = useGame((s) => s.setFlash);
  const selectedDay = useGame((s) => s.selectedDay);
  const allMatches = useGame((s) => s.matches);
  const matches = allMatches.filter((m) => m.day === selectedDay);
  const picks = useGame(allPicks);
  const [matchId, setMatchId] = useState(
    () => matches.find((m) => hasStarted(m))?.id ?? matches[0]?.id ?? '',
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [pending, setPending] = useState<{ side: 'home' | 'away'; id: string; rating: string }>({ side: 'home', id: '', rating: '' });
  const [err, setErr] = useState<string | null>(null);
  const [homeGoals, setHomeGoals] = useState<string>('');
  const [awayGoals, setAwayGoals] = useState<string>('');

  const match = matches.find((m) => m.id === matchId);

  const extract = async () => {
    if (!match || files.length === 0) return;
    setBusy(true); setErr(null); setReview(null);
    try {
      const images = await Promise.all(files.slice(0, 3).map((f) => fileToJpegBase64(f)));
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images, mime: 'image/jpeg', homeName: match.home.name, awayName: match.away.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const players: VisionPlayer[] = Array.isArray(data.players) ? data.players : [];
      if (players.length === 0) throw new Error('não li jogadores na imagem');
      const items: ReviewItem[] = players
        .filter((p) => p.name)
        .map((p) => {
          const side: 'home' | 'away' = p.side === 'away' ? 'away' : 'home';
          const pool = side === 'away' ? match.lineup.away : match.lineup.home;
          const hit = matchByName(p.name!, pool); // MAPEA POR NOME (números são aleatórios)
          return {
            raw: p.name!,
            side,
            rating: typeof p.rating === 'number' && p.rating > 0 ? Math.round(p.rating * 10) / 10 : null,
            starter: p.starter !== false,
            id: hit?.id ?? '',
            auto: !!hit,
          };
        });
      setReview(items);
      const dudas = items.filter((i) => !i.id).length;
      setFlash({
        kind: dudas ? 'err' : 'ok',
        text: dudas ? `📷 ${items.length} lidos · ${dudas} por confirmar` : `📷 ${items.length} reconhecidos`,
      });
    } catch (e) {
      setErr(`Não consegui ler a imagem: ${(e as Error).message}.`);
    } finally {
      setBusy(false);
    }
  };

  const setItemId = (idx: number, id: string) =>
    setReview((r) => (r ? r.map((it, i) => (i === idx ? { ...it, id } : it)) : r));

  const setItemRating = (idx: number, rating: number | null) =>
    setReview((r) => (r ? r.map((it, i) => (i === idx ? { ...it, rating } : it)) : r));

  const enterManual = () => {
    if (!match) return;
    const seen = new Set<string>();
    const items: ReviewItem[] = [];
    // todos os jogadores nas preferências de qualquer amigo neste jogo
    for (const p of picks.filter((p) => p.matchId === match.id)) {
      for (const fid of prefsOf(p)) {
        if (seen.has(fid)) continue;
        seen.add(fid);
        const home = match.lineup.home.find((f) => f.id === fid);
        const away = match.lineup.away.find((f) => f.id === fid);
        const fb = home ?? away;
        if (!fb) continue;
        items.push({ raw: fb.name, side: home ? 'home' : 'away', rating: null, starter: true, id: fb.id, auto: true });
      }
    }
    setReview(items);
    setManualMode(true);
    setErr(null);
    setPending({ side: 'home', id: '', rating: '' });
  };

  const addPending = () => {
    if (!pending.id || !match) return;
    const pool = pending.side === 'away' ? match.lineup.away : match.lineup.home;
    const fb = pool.find((p) => p.id === pending.id);
    if (!fb) return;
    const rating = pending.rating !== '' ? parseFloat(pending.rating) : null;
    setReview((r) => [...(r ?? []), { raw: fb.name, side: pending.side, rating, starter: true, id: pending.id, auto: true }]);
    setPending((p) => ({ ...p, id: '', rating: '' }));
  };

  const removeItem = (idx: number) => setReview((r) => r ? r.filter((_, i) => i !== idx) : r);
  const save = () => {
    if (!match || !review) return;
    const home: Footballer[] = [];
    const away: Footballer[] = [];
    const ratings: Record<string, number> = {};
    const starters: string[] = [];
    const seen = new Set<string>();
    for (const it of review) {
      if (!it.id || seen.has(it.id)) continue;
      const pool = it.side === 'away' ? match.lineup.away : match.lineup.home;
      const fb = pool.find((p) => p.id === it.id);
      if (!fb) continue;
      seen.add(it.id);
      (it.side === 'away' ? away : home).push(fb);
      if (it.rating != null) ratings[it.id] = it.rating;
      if (it.starter) starters.push(it.id);
    }
    if (home.length + away.length === 0 && Object.keys(ratings).length === 0 && homeGoals === '' && awayGoals === '') {
      setErr('Nada para gravar — confirma pelo menos um jogador ou resultado.');
      return;
    }
    savePatch({
      matchId: match.id,
      lineupConfirmed: starters.length > 0,
      ratings: Object.keys(ratings).length ? ratings : undefined,
      lineup: home.length + away.length > 0 ? { home, away } : undefined,
      starters: starters.length ? starters : undefined,
      homeGoals: homeGoals !== '' ? Number(homeGoals) : undefined,
      awayGoals: awayGoals !== '' ? Number(awayGoals) : undefined,
    });
    onClose();
    setFlash({ kind: 'ok', text: `✅ Dados gravados!` });
  };

  return createPortal(
    <div className="rr-modal" onClick={onClose}>
      <div className="rr-sheet slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="rr-sheet-h">
          <span>📷 Importar onze + notas (admin)</span>
          <button className="rr-x" onClick={onClose}>✕</button>
        </div>

        <p className="rr-admin-help muted">
          Escolhe o jogo, mete o resultado e as notas. Usa <b>imagem</b> (IA extrai) ou <b>manual</b> (preenches tu).
        </p>

        <label className="rr-admin-lbl">Jogo</label>
        <select className="rr-admin-select" value={matchId} onChange={(e) => { setMatchId(e.target.value); setReview(null); setHomeGoals(''); setAwayGoals(''); }}>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>{m.home.name} × {m.away.name} · {dayLabel(m.day)}</option>
          ))}
        </select>

        <label className="rr-admin-lbl">Resultado</label>
        <div className="rr-admin-score">
          <input
            className="rr-admin-goals"
            type="number" min="0" max="20" placeholder="0"
            value={homeGoals}
            onChange={(e) => setHomeGoals(e.target.value)}
          />
          <span className="rr-admin-dash">–</span>
          <input
            className="rr-admin-goals"
            type="number" min="0" max="20" placeholder="0"
            value={awayGoals}
            onChange={(e) => setAwayGoals(e.target.value)}
          />
        </div>

        <label className="rr-admin-lbl">Notas — por imagem ou manual</label>
        <div className="rr-admin-extract-row">
          <input
            className="rr-admin-file"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setErr(null); }}
          />
          <button className="rr-admin-extract" onClick={extract} disabled={!match || files.length === 0 || busy}>
            {busy ? <span className="rr-spinner sm" /> : '📷'} Extrair
          </button>
          <button className="rr-admin-manual" onClick={enterManual} disabled={!match}>
            📋 Manual
          </button>
        </div>

        {err && <div className="rr-admin-err">{err}</div>}

        {review && match && (
          <>
            <label className="rr-admin-lbl">
              {manualMode ? `Jogadores adicionados (${review.length})` : `Notas (${review.filter((i) => i.rating != null).length} preenchidas)`}
            </label>
            <div className="rr-review">
              {review.map((it, i) => {
                const pool = it.side === 'away' ? match.lineup.away : match.lineup.home;
                return (
                  <div key={i} className={`rr-review-row ${it.id ? '' : 'unresolved'}`}>
                    <span className="rr-review-side">{it.side === 'home' ? match.home.code : match.away.code}</span>
                    <span className="rr-review-raw">{it.raw}</span>
                    <input
                      className="rr-review-rt-input"
                      type="number" step="0.1" min="0" max="10"
                      placeholder="—"
                      value={it.rating ?? ''}
                      onChange={(e) => setItemRating(i, e.target.value !== '' ? parseFloat(e.target.value) : null)}
                    />
                    {manualMode ? (
                      <button className="rr-review-rm" onClick={() => removeItem(i)}>×</button>
                    ) : (
                      <select className="rr-review-select" value={it.id} onChange={(e) => setItemId(i, e.target.value)}>
                        <option value="">— ignorar —</option>
                        {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
              {manualMode && (
                <div className="rr-add-row">
                  <select
                    className="rr-add-side"
                    value={pending.side}
                    onChange={(e) => setPending((p) => ({ ...p, side: e.target.value as 'home' | 'away', id: '' }))}
                  >
                    <option value="home">{match.home.code}</option>
                    <option value="away">{match.away.code}</option>
                  </select>
                  <select
                    className="rr-add-player"
                    value={pending.id}
                    onChange={(e) => setPending((p) => ({ ...p, id: e.target.value }))}
                  >
                    <option value="">— jogador —</option>
                    {(pending.side === 'home' ? match.lineup.home : match.lineup.away)
                      .filter((p) => !review.some((r) => r.id === p.id))
                      .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    className="rr-review-rt-input"
                    type="number" step="0.1" min="0" max="10"
                    placeholder="nota"
                    value={pending.rating}
                    onChange={(e) => setPending((p) => ({ ...p, rating: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addPending()}
                  />
                  <button className="rr-add-btn" onClick={addPending} disabled={!pending.id}>+</button>
                </div>
              )}
            </div>
            <button className="rr-admin-save" onClick={save}>Gravar e partilhar</button>
          </>
        )}

        {!review && (homeGoals !== '' || awayGoals !== '') && (
          <button className="rr-admin-save" onClick={save}>Gravar resultado</button>
        )}
      </div>
    </div>,
    document.body,
  );
}
