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
import type { Friend, Help, Match, Pick, StandingRow } from './types';

const REDE_MIN = 6.5;
const TIRA_PENALTY = 2;

export function isOpen(match: Match): boolean {
  return match.status === 'upcoming';
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

/** Classificação geral = soma de ratings por amigo. */
export function standings(friends: Friend[], matches: Match[], picks: Pick[]): StandingRow[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const submitted = submittedSets(friends, picks);
  const rows: StandingRow[] = friends.map((friend) => {
    let total = 0;
    let scored = 0;
    let best = 0;
    for (const p of picks) {
      if (p.friendId !== friend.id) continue;
      const m = byId.get(p.matchId);
      if (!m || m.status !== 'finished') continue;
      const r = ratingOf(m, p.footballerId);
      total += r;
      if (r > 0) scored++;
      if (r > best) best = r;
    }
    // não escolheu → leva o pior rating de cada jogo terminado que ignorou
    for (const m of matches) {
      if (m.status !== 'finished' || submitted.get(friend.id)!.has(m.id)) continue;
      total += worstRatingOf(m);
    }
    return { friend, total: round1(total), picks: scored, best: round1(best) };
  });
  // ordena por total desc; desempate por melhor individual, depois nº de jogos
  return rows.sort((a, b) => b.total - a.total || b.best - a.best || b.picks - a.picks);
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Classificação com as AJUDAS da roda aplicadas.
 * Ordem: 1) roubo reatribui o jogador (e tira ao dono); 2) rede/dois ajustam o
 * que cada um ganha; 3) tira-2 desconta a quem tiver o jogador-alvo.
 */
export function standingsWithHelps(
  friends: Friend[],
  matches: Match[],
  picks: Pick[],
  helps: Help[],
): StandingRow[] {
  const byId = new Map(matches.map((m) => [m.id, m]));

  // escolha efetiva: friendId -> (matchId -> footballerId)
  const eff = new Map<string, Map<string, string>>();
  for (const f of friends) eff.set(f.id, new Map());
  for (const p of picks) eff.get(p.friendId)?.set(p.matchId, p.footballerId);

  // 1) ROUBO: o autor fica com o jogador; o dono anterior perde-o nesse jogo.
  for (const h of helps) {
    if (h.ajuda !== 'rouba' || !h.targetFootballerId) continue;
    for (const f of friends) {
      if (f.id === h.friendId) continue;
      if (eff.get(f.id)?.get(h.matchId) === h.targetFootballerId) eff.get(f.id)!.delete(h.matchId);
    }
    eff.get(h.friendId)?.set(h.matchId, h.targetFootballerId);
  }

  const has = (friendId: string, ajuda: string, matchId: string) =>
    helps.find((h) => h.ajuda === ajuda && h.friendId === friendId && h.matchId === matchId);

  // 2) ganho por (amigo, jogo terminado) com rede/dois
  const earned = new Map<string, number>(); // `${friendId}|${matchId}`
  for (const f of friends) {
    for (const [matchId, fb] of eff.get(f.id)!) {
      const m = byId.get(matchId);
      if (!m || m.status !== 'finished') continue;
      let e = ratingOf(m, fb);
      const dois = has(f.id, 'dois', matchId);
      if (dois?.secondId) e = Math.max(e, ratingOf(m, dois.secondId));
      if (has(f.id, 'rede', matchId)) e = Math.max(e, REDE_MIN);
      earned.set(`${f.id}|${matchId}`, e);
    }
  }

  // 3) TIRA-2: desconta a quem tiver o jogador-alvo nesse jogo terminado.
  for (const h of helps) {
    if (h.ajuda !== 'tira' || !h.targetFootballerId) continue;
    const m = byId.get(h.matchId);
    if (!m || m.status !== 'finished') continue;
    for (const f of friends) {
      if (eff.get(f.id)?.get(h.matchId) === h.targetFootballerId) {
        const k = `${f.id}|${h.matchId}`;
        earned.set(k, Math.max(0, (earned.get(k) ?? 0) - TIRA_PENALTY));
      }
    }
  }

  // 4) NÃO ESCOLHEU: pior rating do jogo a quem não fez palpite (original — quem
  //    foi roubado já submeteu, por isso mantém a mecânica do roubo, não esta).
  const submitted = submittedSets(friends, picks);

  const rows: StandingRow[] = friends.map((friend) => {
    let total = 0, scored = 0, best = 0;
    for (const [k, e] of earned) {
      if (!k.startsWith(`${friend.id}|`)) continue;
      total += e;
      if (e > 0) scored++;
      if (e > best) best = e;
    }
    for (const m of matches) {
      if (m.status !== 'finished') continue;
      if (submitted.get(friend.id)!.has(m.id)) continue; // fez palpite (mesmo que roubado)
      if (eff.get(friend.id)!.has(m.id)) continue; // ganhou jogador via roubo
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
