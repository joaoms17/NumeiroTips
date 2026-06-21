/** Roda diária de ajudas do RATING ROYALE. */
import type { AjudaId } from './types';

export interface AjudaMeta {
  id: AjudaId;
  emoji: string;
  name: string;
  short: string;
  /** Precisa de escolher um 2º jogador / alvo ao aplicar? */
  needs: 'none' | 'second' | 'target' | 'steal';
}

export const AJUDAS: AjudaMeta[] = [
  { id: 'rede', emoji: '🛡️', name: 'Rede de Segurança', short: 'mínimo 6.5 nesse jogo', needs: 'none' },
  { id: 'dois', emoji: '⭐', name: 'Dois, conta o melhor', short: 'leva os teus 2 melhores, fica o melhor', needs: 'none' },
  { id: 'nenhuma', emoji: '🚫', name: 'Nenhuma ajuda', short: 'calhou azar', needs: 'none' },
  { id: 'tira', emoji: '😈', name: 'Tira-2 (às cegas)', short: '−2 a quem tiver o jogador', needs: 'target' },
  { id: 'rouba', emoji: '🕵️', name: 'Roubo', short: 'escolhes primeiro (prioridade)', needs: 'none' },
];

export function ajudaMeta(id: AjudaId): AjudaMeta {
  return AJUDAS.find((a) => a.id === id) ?? AJUDAS[2];
}

/** Sorteia uma ajuda (todas com igual probabilidade). */
export function spinAjuda(rnd: () => number = Math.random): AjudaId {
  return AJUDAS[Math.floor(rnd() * AJUDAS.length)].id;
}
