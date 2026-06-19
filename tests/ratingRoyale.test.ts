import { describe, it, expect } from 'vitest';
import { canPick, standings, standingsWithHelps, takenInMatch, usedByFriendOnDay, pickOrder, turnBlockedBy } from '../src/game/scoring';
import type { Friend, Help, Match, Pick } from '../src/game/types';

const FR: Friend[] = [
  { id: 'a', name: 'A', pin: '1', emoji: '🦊', initials: 'AA', color: '#f00' },
  { id: 'b', name: 'B', pin: '2', emoji: '🐉', initials: 'BB', color: '#0f0' },
  { id: 'c', name: 'C', pin: '3', emoji: '🦅', initials: 'CC', color: '#00f' },
  { id: 'd', name: 'D', pin: '4', emoji: '🐺', initials: 'DD', color: '#ff0' },
];

const base = (id: string, day: string, status: Match['status'], extra: Partial<Match> = {}): Match => ({
  id, day, kickoff: `${day}T20:00:00Z`, stage: 'G', status,
  home: { code: 'X', name: 'X', flag: '⚽' }, away: { code: 'Y', name: 'Y', flag: '⚽' },
  lineup: {
    home: [{ id: 'X-7', name: 'P7', team: 'X', pos: 'AVA', number: 7 }],
    away: [{ id: 'Y-9', name: 'P9', team: 'Y', pos: 'AVA', number: 9 }],
  },
  ...extra,
});

describe('RATING ROYALE — pontuação', () => {
  const m1 = base('m1', '2026-06-16', 'finished', { ratings: { 'X-7': 8.4, 'Y-9': 7.0 } });
  const m2 = base('m2', '2026-06-16', 'finished', { ratings: { 'X-7': 6.5 } });
  const matches = [m1, m2];
  const picks: Pick[] = [
    { friendId: 'a', matchId: 'm1', footballerId: 'X-7', at: '' }, // 8.4
    { friendId: 'a', matchId: 'm2', footballerId: 'X-7', at: '' }, // 6.5 → total 14.9
    { friendId: 'b', matchId: 'm1', footballerId: 'Y-9', at: '' }, // 7.0
  ];

  it('soma ratings e ordena', () => {
    const rows = standings(FR, matches, picks);
    expect(rows[0].friend.id).toBe('a');
    expect(rows[0].total).toBe(14.9);
    expect(rows[0].picks).toBe(2);
    expect(rows[0].best).toBe(8.4);
    // b: 7.0 (m1) + pior de m2 (6.5, não escolheu) = 13.5
    expect(rows[1].friend.id).toBe('b');
    expect(rows[1].total).toBe(13.5);
    expect(rows[1].picks).toBe(1);
  });

  it('quem não escolhe leva o pior rating do jogo', () => {
    // c não escolheu em nenhum jogo: pior de m1 (7.0) + pior de m2 (6.5)
    const rows = standings(FR, matches, picks);
    const c = rows.find((r) => r.friend.id === 'c')!;
    expect(c.total).toBe(13.5);
    expect(c.picks).toBe(0); // penalização não conta como jogo "pontuado"
  });

  it('jogo não terminado não conta (nem penaliza quem não escolheu)', () => {
    const live = base('m3', '2026-06-16', 'live', { ratings: { 'X-7': 9 } });
    const rows = standings(FR, [live], [{ friendId: 'a', matchId: 'm3', footballerId: 'X-7', at: '' }]);
    expect(rows[0].total).toBe(0);
  });
});

describe('RATING ROYALE — regras de escolha', () => {
  const open = base('o1', '2026-06-18', 'upcoming');
  const open2 = base('o2', '2026-06-18', 'upcoming');
  const matches = [open, open2];

  it('não dá para escolher jogador já tomado por outro no mesmo jogo', () => {
    const picks: Pick[] = [{ friendId: 'b', matchId: 'o1', footballerId: 'X-7', at: '' }];
    expect(canPick(picks, matches, 'a', open, 'X-7').ok).toBe(false);
    expect(takenInMatch(picks, 'o1', 'a').has('X-7')).toBe(true);
  });

  it('não dá para repetir o mesmo jogador no mesmo dia', () => {
    const picks: Pick[] = [{ friendId: 'a', matchId: 'o1', footballerId: 'X-7', at: '' }];
    expect(canPick(picks, matches, 'a', open2, 'X-7').ok).toBe(false);
    expect(usedByFriendOnDay(picks, matches, 'a', '2026-06-18', 'o2').has('X-7')).toBe(true);
  });

  it('não dá para escolher num jogo já começado', () => {
    const closed = base('c1', '2026-06-18', 'live');
    expect(canPick([], [closed], 'a', closed, 'X-7').ok).toBe(false);
  });

  it('escolha válida passa', () => {
    expect(canPick([], matches, 'a', open, 'X-7').ok).toBe(true);
  });

  it('a ordem de escolha roda entre jogos do dia', () => {
    const first = pickOrder(FR, matches, open).map((f) => f.id);
    const second = pickOrder(FR, matches, open2).map((f) => f.id);
    expect(first[0]).toBe('a');
    expect(second[0]).toBe('b'); // rodou
  });

  it('só se pode escolher na sua vez (ordem respeitada)', () => {
    const order = pickOrder(FR, matches, open); // [a, b, c, d]
    // ninguém escolheu → 'b' está bloqueado pelo 'a'
    expect(turnBlockedBy([], order, 'o1', 'b')?.id).toBe('a');
    // 'a' é o primeiro → livre
    expect(turnBlockedBy([], order, 'o1', 'a')).toBeNull();
    // depois de 'a' escolher, 'b' fica livre mas 'c' ainda espera por 'b'
    const picks = [{ friendId: 'a', matchId: 'o1', footballerId: 'X-7', at: '' }];
    expect(turnBlockedBy(picks, order, 'o1', 'b')).toBeNull();
    expect(turnBlockedBy(picks, order, 'o1', 'c')?.id).toBe('b');
  });
});

describe('RATING ROYALE — ajudas da roda', () => {
  const m = base('mh', '2026-06-16', 'finished', { ratings: { 'X-7': 4.0, 'Y-9': 8.0 } });
  const matches = [m];
  const picks: Pick[] = [
    { friendId: 'a', matchId: 'mh', footballerId: 'X-7', at: '' }, // 4.0
    { friendId: 'b', matchId: 'mh', footballerId: 'Y-9', at: '' }, // 8.0
  ];

  it('🛡️ rede garante mínimo 6.5', () => {
    const helps: Help[] = [{ friendId: 'a', ajuda: 'rede', matchId: 'mh' }];
    const rows = standingsWithHelps(FR, matches, picks, helps);
    expect(rows.find((r) => r.friend.id === 'a')!.total).toBe(6.5);
  });

  it('⭐ dois conta o melhor dos dois jogadores', () => {
    const helps: Help[] = [{ friendId: 'a', ajuda: 'dois', matchId: 'mh', secondId: 'Y-9' }];
    const rows = standingsWithHelps(FR, matches, picks, helps);
    expect(rows.find((r) => r.friend.id === 'a')!.total).toBe(8.0);
  });

  it('😈 tira-2 desconta a quem tiver o jogador-alvo', () => {
    const helps: Help[] = [{ friendId: 'a', ajuda: 'tira', matchId: 'mh', targetFootballerId: 'Y-9' }];
    const rows = standingsWithHelps(FR, matches, picks, helps);
    expect(rows.find((r) => r.friend.id === 'b')!.total).toBe(6.0); // 8 - 2
  });

  it('🕵️ roubo passa o jogador para o autor e tira ao dono', () => {
    const helps: Help[] = [{ friendId: 'a', ajuda: 'rouba', matchId: 'mh', targetFootballerId: 'Y-9' }];
    const rows = standingsWithHelps(FR, matches, picks, helps);
    expect(rows.find((r) => r.friend.id === 'a')!.total).toBe(8.0); // rouba o Y-9
    expect(rows.find((r) => r.friend.id === 'b')!.total).toBe(0); // perdeu-o
  });

  it('depois de roubado, o dono reescolhe outro e pontua-o', () => {
    // 'a' rouba o Y-9; 'b' reescolheu o X-7 (4.0)
    const rePicks: Pick[] = [
      { friendId: 'b', matchId: 'mh', footballerId: 'X-7', at: '' },
    ];
    const helps: Help[] = [{ friendId: 'a', ajuda: 'rouba', matchId: 'mh', targetFootballerId: 'Y-9' }];
    const rows = standingsWithHelps(FR, matches, rePicks, helps);
    expect(rows.find((r) => r.friend.id === 'a')!.total).toBe(8.0); // ficou com o roubado
    expect(rows.find((r) => r.friend.id === 'b')!.total).toBe(4.0); // pontua a nova escolha
  });
});
