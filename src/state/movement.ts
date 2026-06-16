/**
 * Histórico de movimento de linha + sinal antecipado ("steam").
 *
 * Para cada seleção viva guardamos amostras (probabilidade justa sharp e melhor
 * odd das casas-alvo) ao longo do tempo. A ideia da Fase 3: quando a régua sharp
 * se MOVE (a prob. justa sobe) antes de a casa-alvo reagir, há um sinal de que o
 * valor vai aparecer/aumentar — é o "steam". Sinalizamos isso.
 */

export interface MovementSample {
  t: number; // epoch ms
  fairProb: number;
  bestOdd: number;
}

export interface MovementInfo {
  dir: 'up' | 'down' | 'flat';
  /** Variação da prob. justa na janela (pp, ex.: +0.012 = +1.2pp). */
  deltaProb: number;
  /** Variação da melhor odd da casa na janela. */
  deltaOdd: number;
  /** Sinal antecipado: a sharp moveu-se a favor e a casa ainda não reagiu. */
  steam: boolean;
}

const WINDOW_MS = 90_000; // janela de 90s
const STEAM_PROB = 0.01; // ≥ 1pp de movimento na prob. justa
const MAX_SAMPLES = 40;

const history = new Map<string, MovementSample[]>();

/** Regista uma amostra para uma seleção e devolve o histórico atualizado. */
export function recordSample(id: string, sample: MovementSample): void {
  const arr = history.get(id) ?? [];
  arr.push(sample);
  // limita por tamanho e por idade
  const cutoff = sample.t - WINDOW_MS * 3;
  let trimmed = arr.filter((s) => s.t >= cutoff);
  if (trimmed.length > MAX_SAMPLES) trimmed = trimmed.slice(trimmed.length - MAX_SAMPLES);
  history.set(id, trimmed);
}

/** Calcula o movimento de uma seleção dentro da janela. */
export function computeMovement(id: string, now: number): MovementInfo {
  const arr = history.get(id) ?? [];
  const inWindow = arr.filter((s) => s.t >= now - WINDOW_MS);
  if (inWindow.length < 2) {
    return { dir: 'flat', deltaProb: 0, deltaOdd: 0, steam: false };
  }
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const deltaProb = last.fairProb - first.fairProb;
  const deltaOdd = last.bestOdd - first.bestOdd;

  let dir: MovementInfo['dir'] = 'flat';
  if (deltaProb > 0.002) dir = 'up';
  else if (deltaProb < -0.002) dir = 'down';

  // Steam: a prob. justa subiu ≥ 1pp (sharp move a favor) e a odd da casa
  // ainda NÃO caiu o suficiente (casa a reagir devagar) → valor a abrir.
  const steam = deltaProb >= STEAM_PROB && deltaOdd > -0.05;

  return { dir, deltaProb, deltaOdd, steam };
}

/** Limpa histórico de seleções que já não estão vivas (evita crescer sem fim). */
export function pruneHistory(aliveIds: Set<string>): void {
  for (const id of history.keys()) {
    if (!aliveIds.has(id)) history.delete(id);
  }
}
