/** Configuração do RATING ROYALE — os 4 amigos e constantes do jogo. */
import type { Friend } from './types';

export const APP_NAME = 'RATING ROYALE';
export const APP_TAG = 'Mundial 2026 · os 4';

/** Fuso dos EUA para agrupar os jogos por "dia" (Mundial 2026 USA/CAN/MEX). */
export const USA_TZ = 'America/New_York';

/** Os 4 jogadores. Entram com o nome + PIN. */
export const FRIENDS: Friend[] = [
  { id: 'ruben', name: 'RUBEN', pin: '9999', emoji: '🦊', initials: 'RS', color: '#ff5a5f' },
  { id: 'joao', name: 'JOAO', pin: '8888', emoji: '🐉', initials: 'JS', color: '#22d3ee' },
  { id: 'tiago', name: 'TIAGO', pin: '7777', emoji: '🦅', initials: 'TA', color: '#a78bfa' },
  { id: 'jaime', name: 'JAIME', pin: '6666', emoji: '🐺', initials: 'JR', color: '#34d399' },
];

export function friendById(id: string | null | undefined): Friend | undefined {
  return FRIENDS.find((f) => f.id === id);
}
