/**
 * RATING ROYALE — tipos do jogo.
 * ==============================
 * Jogo dos 4 amigos no Mundial 2026: por cada jogo escolhes 1 jogador; quando o
 * jogo acaba, o RATING real desse jogador soma à tua conta. Ganha quem tiver
 * mais rating acumulado. Escolha rotativa, sem repetir jogador no mesmo dia.
 */

export interface Friend {
  id: string;
  name: string;
  pin: string;
  emoji: string;
  color: string;
}

export type Pos = 'GR' | 'DEF' | 'MED' | 'AVA';

export interface Footballer {
  id: string;
  name: string;
  team: string; // código da seleção (ex.: 'POR')
  pos: Pos;
  number: number;
}

export interface NationTeam {
  code: string; // 'POR'
  name: string; // 'Portugal'
  flag: string; // emoji 🇵🇹
}

export type MatchStatus = 'upcoming' | 'live' | 'finished';

export interface Match {
  id: string;
  /** Dia (data nos EUA, YYYY-MM-DD) a que o jogo pertence. */
  day: string;
  kickoff: string; // ISO
  stage: string; // 'Grupo A', 'Oitavos', ...
  home: NationTeam;
  away: NationTeam;
  status: MatchStatus;
  minute?: number;
  homeGoals?: number;
  awayGoals?: number;
  /** Onze provável / candidatos a escolher, por equipa. */
  lineup: { home: Footballer[]; away: Footballer[] };
  /** Rating final por jogador (só quando finished). */
  ratings?: Record<string, number>;
}

export interface Pick {
  friendId: string;
  matchId: string;
  footballerId: string;
  at: string; // ISO de quando escolheu
}

export interface StandingRow {
  friend: Friend;
  total: number; // soma de ratings
  picks: number; // nº de jogos pontuados
  best: number; // melhor rating individual
}
