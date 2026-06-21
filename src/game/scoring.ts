/**
 * Pontuação e regras do RATING ROYALE (puro, testável).
 *
 * Pontuação = soma dos RATINGS dos jogadores escolhidos (só conta jogos
 * terminados com rating). Regras de escolha:
 *  - 1 jogador por jogo;
 *  - jogador único por jogo entre os amigos (quem escolhe primeiro trava);
 *  - não repetir o mesmo jogador no MESMO dia (rotativo);
 *  - só se pode escolher antes do apito (status 'upcoming').
 */
import type { Friend, Help, Match, Pick, ResolvedPick, StandingRow } from './types';

const REDE_MIN = 6.5;
const TIRA_PENALTY = 2;
/** Máximo de preferências que cada amigo submete por jogo. */
export const MAX_PREFS = 5;

/** Lista ordenada de preferências de um palpite (retrocompatível com 1 só id). */
export function prefsOf(p: Pick): string[] {
  return p.prefs && p.prefs.length ? p.prefs : p.footballerId ? [p.footballerId] : [];
}

export function isOpen(match: Match): boolean {
  return match.status === 'upcoming';
}

/** O jogo já começou? Status não-upcoming OU a hora de início já passou. */
export function hasStarted(match: Match, now: number = Date.now()): boolean {
  if (match.status !== 'upcoming') return true;
  const t = new Date(match.kickoff).getTime();
  return Number.isFinite(t) && now >= t;
}

/** ~2h15 após o início, um jogo é dado como TERMINADO (notas definitivas). */
const FULLTIME_MS = 135 * 60_000;
export type MatchPhase = 'upcoming' | 'live' | 'finished';

/**
 * Fase do jogo. O status explícito ('live'/'finished') tem prioridade; senão
 * (jogos do calendário ficam 'upcoming') decide-se pela HORA:
 *  - antes do início → upcoming
 *  - do início até ~2h15 depois → live (notas provisórias)
 *  - depois → finished (notas definitivas)
 */
export function matchPhase(match: Match, now: number = Date.now()): MatchPhase {
  if (match.status === 'finished') return 'finished';
  if (match.status === 'live') return 'live';
  const t = new Date(match.kickoff).getTime();
  if (!Number.isFinite(t) || now < t) return 'upcoming';
  return now >= t + FULLTIME_MS ? 'finished' : 'live';
}

/** Rating de um jogador num jogo (0 se não jogou / sem rating). */
export function ratingOf(match: Match, footballerId: string): number {
  return match.ratings?.[footballerId] ?? 0;
}

/**
 * Pior rating atribuído num jogo (mínimo entre quem jogou). É o que leva quem
 * NÃO escolheu jogador nesse jogo. 0 se ainda não há ratings.
 */
export function worstRatingOf(match: Match): number {
  const vals = Object.values(match.ratings ?? {});
  return vals.length ? Math.min(...vals) : 0;
}

/** Conjunto de jogos onde cada amigo fez palpite (palpites originais). */
function submittedSets(friends: Friend[], picks: Pick[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const f of friends) map.set(f.id, new Set());
  for (const p of picks) map.get(p.friendId)?.add(p.matchId);
  return map;
}

/** Jogadores já travados por OUTROS amigos neste jogo. */
export function takenInMatch(picks: Pick[], matchId: string, exceptFriend?: string): Set<string> {
  const s = new Set<string>();
  for (const p of picks) {
    if (p.matchId === matchId && p.friendId !== exceptFriend) s.add(p.footballerId);
  }
  return s;
}

/** Jogadores já usados por um amigo num determinado dia. */
export function usedByFriendOnDay(
  picks: Pick[],
  matches: Match[],
  friendId: string,
  day: string,
  exceptMatch?: string,
): Set<string> {
  const dayMatchIds = new Set(matches.filter((m) => m.day === day).map((m) => m.id));
  const s = new Set<string>();
  for (const p of picks) {
    if (p.friendId !== friendId) continue;
    if (p.matchId === exceptMatch) continue;
    if (dayMatchIds.has(p.matchId)) s.add(p.footballerId);
  }
  return s;
}

export interface PickCheck {
  ok: boolean;
  reason?: string;
}

/** Valida se um amigo pode escolher um jogador num jogo. */
export function canPick(
  picks: Pick[],
  matches: Match[],
  friendId: string,
  match: Match,
  footballerId: string,
): PickCheck {
  if (!isOpen(match)) return { ok: false, reason: 'Jogo já fechou (começou).' };
  if (takenInMatch(picks, match.id, friendId).has(footballerId))
    return { ok: false, reason: 'Jogador já escolhido por outro neste jogo.' };
  if (usedByFriendOnDay(picks, matches, friendId, match.day, match.id).has(footballerId))
    return { ok: false, reason: 'Já usaste este jogador hoje.' };
  return { ok: true };
}

/**
 * Ordem de escolha (rotativa): roda os amigos pela posição do jogo na lista
 * (ordenada por hora). A cada jogo, quem começa avança um lugar.
 */
export function pickOrder(friends: Friend[], matches: Match[], match: Match): Friend[] {
  const sorted = [...matches].sort(byKickoff);
  const idx = Math.max(0, sorted.findIndex((m) => m.id === match.id));
  const n = friends.length;
  return Array.from({ length: n }, (_, i) => friends[(i + idx) % n]);
}

export function byKickoff(a: Match, b: Match): number {
  return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
}

/**
 * Vez de escolha: respeita a ordem rotativa. Devolve o amigo ANTERIOR na ordem
 * que ainda não escolheu neste jogo (bloqueia), ou null se já é a vez de
 * `friendId` (ou se ele já escolheu).
 */
export function turnBlockedBy(
  picks: Pick[],
  order: Friend[],
  matchId: string,
  friendId: string,
): Friend | null {
  const picked = new Set(picks.filter((p) => p.matchId === matchId).map((p) => p.friendId));
  for (const f of order) {
    if (f.id === friendId) return null; // chegou a mim sem bloqueios
    if (!picked.has(f.id)) return f;     // alguém antes ainda não escolheu
  }
  return null;
}

/**
 * Ainda posso trocar a minha escolha? Só enquanto NINGUÉM a seguir a mim na
 * ordem tiver escolhido (assim que o próximo escolhe, a minha tranca).
 */
export function canChangePick(
  picks: Pick[],
  order: Friend[],
  matchId: string,
  friendId: string,
): boolean {
  const picked = new Set(picks.filter((p) => p.matchId === matchId).map((p) => p.friendId));
  const myIdx = order.findIndex((f) => f.id === friendId);
  if (myIdx < 0) return true;
  for (let i = myIdx + 1; i < order.length; i++) {
    if (picked.has(order[i].id)) return false; // alguém depois já escolheu
  }
  return true;
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Resolve as escolhas EFETIVAS de um jogo a partir das listas de preferências.
 * Ordem: quem usou ROUBO resolve primeiro (prioridade), na ordem rotativa entre
 * si; depois os restantes na ordem rotativa. Cada um leva a preferência mais
 * alta ainda livre. A ajuda 'dois' consome um 2º jogador (a preferência seguinte
 * disponível) e mais tarde conta o melhor dos dois.
 */
export function resolveMatch(
  friends: Friend[],
  matches: Match[],
  match: Match,
  picks: Pick[],
  helps: Help[],
): ResolvedPick[] {
  const prefByFriend = new Map<string, string[]>();
  for (const p of picks) if (p.matchId === match.id) prefByFriend.set(p.friendId, prefsOf(p));

  const hasHelp = (friendId: string, ajuda: string) =>
    helps.some((h) => h.ajuda === ajuda && h.friendId === friendId && h.matchId === match.id);

  const rotative = pickOrder(friends, matches, match);
  const order = [
    ...rotative.filter((f) => hasHelp(f.id, 'rouba')), // roubo → prioridade
    ...rotative.filter((f) => !hasHelp(f.id, 'rouba')),
  ];

  const taken = new Set<string>();
  const out: ResolvedPick[] = [];
  for (const f of order) {
    const prefs = prefByFriend.get(f.id);
    if (!prefs || prefs.length === 0) continue; // não submeteu
    const primary = prefs.find((id) => !taken.has(id));
    if (primary) taken.add(primary);
    let second: string | undefined;
    if (hasHelp(f.id, 'dois')) {
      second = prefs.find((id) => !taken.has(id) && id !== primary);
      if (second) taken.add(second);
    }
    out.push({ friendId: f.id, matchId: match.id, footballerId: primary, secondId: second });
  }
  return out;
}

/** Classificação geral = soma de ratings por amigo (sem ajudas). */
export function standings(friends: Friend[], matches: Match[], picks: Pick[]): StandingRow[] {
  return standingsWithHelps(friends, matches, picks, []);
}

/**
 * Classificação com as listas de preferências resolvidas + AJUDAS aplicadas.
 * Por jogo (não-upcoming): resolve as escolhas efetivas, soma o rating (dois →
 * melhor dos dois; rede → mínimo 6.5; tira-2 → desconta ao alvo). Quem não
 * submeteu — ou ficou sem jogador (todas as preferências tomadas) — leva a pior
 * nota do jogo, só quando o jogo termina.
 */
export function standingsWithHelps(
  friends: Friend[],
  matches: Match[],
  picks: Pick[],
  helps: Help[],
): StandingRow[] {
  const submitted = submittedSets(friends, picks);
  const earned = new Map<string, number>(); // `${friendId}|${matchId}`

  for (const m of matches) {
    if (matchPhase(m) === 'upcoming') continue; // live (provisório) + terminado
    const resolved = resolveMatch(friends, matches, m, picks, helps);
    for (const rp of resolved) {
      let e: number;
      if (rp.footballerId) {
        e = ratingOf(m, rp.footballerId);
        if (rp.secondId) e = Math.max(e, ratingOf(m, rp.secondId)); // dois: conta o melhor
      } else {
        e = worstRatingOf(m); // submeteu mas ficou sem jogador → pior nota
      }
      if (helps.some((h) => h.ajuda === 'rede' && h.friendId === rp.friendId && h.matchId === m.id))
        e = Math.max(e, REDE_MIN);
      earned.set(`${rp.friendId}|${m.id}`, e);
    }
    // TIRA-2: desconta a quem tiver o jogador-alvo neste jogo.
    for (const h of helps) {
      if (h.ajuda !== 'tira' || !h.targetFootballerId || h.matchId !== m.id) continue;
      for (const rp of resolved) {
        if (rp.footballerId === h.targetFootballerId || rp.secondId === h.targetFootballerId) {
          const k = `${rp.friendId}|${m.id}`;
          earned.set(k, Math.max(0, (earned.get(k) ?? 0) - TIRA_PENALTY));
        }
      }
    }
  }

  const rows: StandingRow[] = friends.map((friend) => {
    let total = 0, scored = 0, best = 0;
    for (const [k, e] of earned) {
      if (!k.startsWith(`${friend.id}|`)) continue;
      total += e;
      if (e > 0) scored++;
      if (e > best) best = e;
    }
    // não submeteu → pior nota de cada jogo TERMINADO que ignorou
    for (const m of matches) {
      if (matchPhase(m) !== 'finished') continue;
      if (submitted.get(friend.id)!.has(m.id)) continue;
      total += worstRatingOf(m);
    }
    return { friend, total: round1(total), picks: scored, best: round1(best) };
  });
  return rows.sort((a, b) => b.total - a.total || b.best - a.best || b.picks - a.picks);
}

/** Constrói a lista de ajudas APLICADAS a partir dos spins. */
export function helpsFromSpins(
  spins: Record<string, { ajuda: string; matchId?: string; secondId?: string; targetFootballerId?: string }>,
): Help[] {
  const out: Help[] = [];
  for (const [key, s] of Object.entries(spins)) {
    if (!s.matchId || s.ajuda === 'nenhuma') continue;
    const friendId = key.split('|')[0];
    out.push({
      friendId,
      ajuda: s.ajuda as Help['ajuda'],
      matchId: s.matchId,
      secondId: s.secondId,
      targetFootballerId: s.targetFootballerId,
    });
  }
  return out;
}
