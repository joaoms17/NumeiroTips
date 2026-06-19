/** Jogos do dia + escolha do jogador (rotativo) + ajudas da roda. Mobile, animado. */
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGame, allPicks, dayList, matchesOfDay, myPick, mySpin, claimedInMatch, iWasRobbed } from '../../game/store';
import { isOpen, hasStarted, matchPhase, takenInMatch, usedByFriendOnDay, pickOrder, turnBlockedBy, canChangePick } from '../../game/scoring';
import { FRIENDS } from '../../game/config';
import { ajudaMeta } from '../../game/wheel';
import { dayLabel, dayNum, kickLabel, relToday } from '../../game/format';
import type { Footballer, Match, MatchPatch, NationTeam } from '../../game/types';
import { RodaBanner } from './Roda';
import { Flag } from './Flag';

type HelpMode = 'second' | 'target' | 'steal';

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
  const pick = useGame((s) => myPick(s, match.id));
  const picks = useGame(allPicks);
  const allMatches = useGame((s) => s.matches);
  const spinRec = useGame((s) => mySpin(s, match.day));
  const applyHelp = useGame((s) => s.applyHelp);
  const [picker, setPicker] = useState<null | 'pick' | HelpMode>(null);

  const robbed = useGame((s) => iWasRobbed(s, match.id));
  const picked = pick && !robbed ? findFootballer(match, pick.footballerId) : null;
  const started = hasStarted(match); // hora passou ou já live/finished
  const open = isOpen(match) && !started; // ainda dá para escolher
  const order = pickOrder(FRIENDS, allMatches, match);
  const pickedIds = new Set(picks.filter((p) => p.matchId === match.id).map((p) => p.friendId));
  const currentTurn = order.find((f) => !pickedIds.has(f.id)) ?? null;
  const waitingFor = open ? turnBlockedBy(picks, order, match.id, meId) : null;
  const canChange = canChangePick(picks, order, match.id, meId); // trancada quando o próximo escolhe

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

      <div className="rr-order">
        {order.map((f, i) => (
          <span
            key={f.id}
            className={`rr-order-chip ${pickedIds.has(f.id) ? 'done' : ''} ${currentTurn?.id === f.id && open ? 'turn' : ''}`}
            style={{ '--c': f.color } as CSSProperties}
            title={`${i + 1}º a escolher — ${f.name}${pickedIds.has(f.id) ? ' (já escolheu)' : ''}`}
          >
            {f.initials}
          </span>
        ))}
        <span className="rr-order-lbl muted">ordem de escolha</span>
      </div>

      {helpHere && (
        <div className="rr-help-here">{ajudaMeta(spinRec!.ajuda).emoji} ajuda aplicada aqui</div>
      )}

      {open && robbed && (
        <div className="rr-robbed">🕵️ Roubaram-te o jogador! Escolhe outro.</div>
      )}

      {started ? (
        <RevealPicks match={match} picks={picks} meId={meId} />
      ) : picked ? (
        <div className="rr-mypick">
          <div className="rr-mypick-info">
            <span className="rr-pl-name">{picked.name}</span>
            <span className="rr-pl-team"><Flag cc={teamByCode(match, picked.team).cc} flag={teamByCode(match, picked.team).flag} name={picked.team} /></span>
          </div>
          {canChange ? (
            <button className="rr-change" onClick={() => setPicker('pick')}>trocar</button>
          ) : (
            <span className="rr-lock" title="Já não podes trocar — alguém a seguir já escolheu">🔒</span>
          )}
        </div>
      ) : waitingFor ? (
        <div className="rr-wait muted">⏳ aguarda a vez de <b>{waitingFor.initials}</b> · {waitingFor.name}</div>
      ) : (
        <button className="rr-choose" onClick={() => setPicker('pick')}>＋ Escolher jogador</button>
      )}

      {open && helpUnused && (
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

  const starters = new Set(match.starters ?? []);
  const candidates = [...match.lineup.home, ...match.lineup.away].filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );
  // titulares primeiro (quando o onze já foi importado)
  const byTeam = (code: string) =>
    candidates
      .filter((p) => p.team === code)
      .sort((a, b) => Number(starters.has(b.id)) - Number(starters.has(a.id)));

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

  return createPortal(
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
              <div className="rr-pl-group">
                <Flag cc={team.cc} flag={team.flag} name={team.name} /> {team.name}
                {match.lineupConfirmed && starters.size > 0 && <span className="rr-pl-group-xi">onze oficial ✅</span>}
              </div>
              {byTeam(team.code).map((p) => {
                const { dis, tag } = disabledFor(p);
                const isStarter = starters.has(p.id);
                return (
                  <button
                    key={p.id}
                    className={`rr-pl-row ${dis ? 'dis' : ''} ${isStarter ? 'starter' : ''}`}
                    disabled={dis}
                    onClick={() => select(p)}
                  >
                    <span className="rr-pl-name">{p.name}</span>
                    {isStarter && <span className="rr-tag-start">titular</span>}
                    <span className="rr-pl-num">#{p.number}</span>
                    {tag && <span className={tag === 'tomado' ? 'rr-tag-taken' : tag === 'roubar' ? 'rr-tag-steal' : 'rr-tag-used'}>{tag}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
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
function RevealPicks({ match, picks, meId }: { match: Match; picks: ReturnType<typeof allPicks>; meId: string }) {
  const finished = matchPhase(match) === 'finished';
  return (
    <div className="rr-reveal">
      <div className="rr-reveal-h">
        🔓 Escolhas de cada um
        <span className={`rr-reveal-tag ${finished ? 'final' : 'live'}`}>
          {finished ? 'notas definitivas' : 'notas provisórias'}
        </span>
      </div>
      {FRIENDS.map((f) => {
        const fp = picks.find((p) => p.matchId === match.id && p.friendId === f.id);
        const fb = fp ? findFootballer(match, fp.footballerId) : null;
        const rating = fb ? match.ratings?.[fb.id] ?? null : null;
        return (
          <div key={f.id} className={`rr-reveal-row ${f.id === meId ? 'me' : ''}`}>
            <span className="rr-reveal-chip" style={{ '--c': f.color } as CSSProperties}>{f.initials}</span>
            {fb ? (
              <>
                <span className="rr-reveal-name">{fb.name}</span>
                <span className="rr-reveal-team">
                  <Flag cc={teamByCode(match, fb.team).cc} flag={teamByCode(match, fb.team).flag} name={fb.team} />
                </span>
              </>
            ) : (
              <span className="rr-reveal-name muted">não escolheu 😬</span>
            )}
            {rating != null && rating > 0 && (
              <span className={`rr-reveal-rating ${finished ? 'final' : 'live'}`}>
                <CountUp value={rating} />
              </span>
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

/** Constrói o patch (onze + notas) a partir dos jogadores lidos pela visão. */
function patchFromVision(match: Match, players: VisionPlayer[]): MatchPatch {
  const home: Footballer[] = [];
  const away: Footballer[] = [];
  const ratings: Record<string, number> = {};
  const starters: string[] = [];
  for (const p of players) {
    if (typeof p.number !== 'number' || !p.name) continue; // precisa de número p/ id estável
    const code = p.side === 'away' ? match.away.code : match.home.code;
    const id = `${code}-${p.number}`;
    const fb: Footballer = { id, name: p.name, team: code, pos: 'MED', number: p.number };
    (p.side === 'away' ? away : home).push(fb);
    if (typeof p.rating === 'number' && p.rating > 0) ratings[id] = Math.round(p.rating * 10) / 10;
    if (p.starter !== false) starters.push(id);
  }
  return {
    matchId: match.id,
    lineupConfirmed: starters.length > 0,
    ratings: Object.keys(ratings).length ? ratings : undefined,
    lineup: { home, away },
    starters: starters.length ? starters : undefined,
  };
}

/** Painel admin: importa onze + notas por IMAGEM (visão AI) ou colando JSON. */
function AdminImport({ onClose }: { onClose: () => void }) {
  const savePatch = useGame((s) => s.savePatch);
  const setFlash = useGame((s) => s.setFlash);
  const matches = useGame((s) => s.matches);
  const matchIds = new Set(matches.map((m) => m.id));
  const [matchId, setMatchId] = useState(
    () => matches.find((m) => !hasStarted(m))?.id ?? matches[0]?.id ?? '',
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const match = matches.find((m) => m.id === matchId);

  const extract = async () => {
    if (!match || files.length === 0) return;
    setBusy(true);
    setErr(null);
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
      setText(JSON.stringify(patchFromVision(match, players), null, 2));
      setFlash({ kind: 'ok', text: `📷 Li ${players.length} jogadores — confere e grava.` });
    } catch (e) {
      setErr(`Não consegui ler a imagem: ${(e as Error).message}. Podes colar o bloco à mão.`);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      setErr('JSON inválido — confirma que está tudo.');
      return;
    }
    const list = (Array.isArray(data) ? data : [data]) as MatchPatch[];
    const valid = list.filter((p) => p && typeof p.matchId === 'string');
    if (valid.length === 0) {
      setErr('Sem "matchId" — o bloco não parece um patch de jogo.');
      return;
    }
    const unknown = valid.filter((p) => !matchIds.has(p.matchId)).map((p) => p.matchId);
    valid.forEach((p) => savePatch(p));
    onClose();
    setFlash({
      kind: unknown.length ? 'err' : 'ok',
      text: unknown.length
        ? `Guardei ${valid.length}, mas estes IDs não existem: ${unknown.join(', ')}`
        : `✅ ${valid.length} jogo(s) atualizado(s)!`,
    });
  };

  return createPortal(
    <div className="rr-modal" onClick={onClose}>
      <div className="rr-sheet slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="rr-sheet-h">
          <span>✏️ Importar onze + notas (admin)</span>
          <button className="rr-x" onClick={onClose}>✕</button>
        </div>

        <p className="rr-admin-help muted">
          📷 Escolhe o jogo, mete o(s) print(s) do FlashScore e carrega em <b>Extrair</b> — a IA lê o
          onze e as notas. Confere o resultado e grava (fica visível para os 4 em tempo real).
        </p>

        <label className="rr-admin-lbl">Jogo</label>
        <select className="rr-admin-select" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>{m.home.name} × {m.away.name} · {dayLabel(m.day)}</option>
          ))}
        </select>

        <label className="rr-admin-lbl">Print(s) — onze e/ou notas (até 2-3)</label>
        <input
          className="rr-admin-file"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setErr(null); }}
        />
        <button className="rr-admin-extract" onClick={extract} disabled={!match || files.length === 0 || busy}>
          {busy ? <span className="rr-spinner sm" /> : '📷'} Extrair da imagem
        </button>

        <label className="rr-admin-lbl">Bloco (gerado pela imagem ou colado)</label>
        <textarea
          className="rr-admin-text"
          placeholder={'{\n  "matchId": "wc-bra-hai",\n  "lineupConfirmed": true,\n  "ratings": { "BRA-26": 8.3 }\n}'}
          value={text}
          onChange={(e) => { setText(e.target.value); setErr(null); }}
          rows={9}
        />
        {err && <div className="rr-admin-err">{err}</div>}
        <button className="rr-admin-save" onClick={apply} disabled={!text.trim()}>
          Gravar e partilhar
        </button>
      </div>
    </div>,
    document.body,
  );
}
