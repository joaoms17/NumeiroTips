import { describe, it, expect } from 'vitest';
import { canPick, standings, takenInMatch, usedByFriendOnDay, pickOrder } from '../src/game/scoring';
import type { Friend, Match, Pick } from '../src/game/types';

const FR: Friend[] = [
  { id: 'a', name: 'A', pin: '1', emoji: '🦊', color: '#f00' },
  { id: 'b', name: 'B', pin: '2', emoji: '🐉', color: '#0f0' },
  { id: 'c', name: 'C', pin: '3', emoji: '🦅', color: '#00f' },
  { id: 'd', name: 'D', pin: '4', emoji: '🐺', color: '#ff0' },
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
    expect(rows[1].friend.id).toBe('b');
    expect(rows[1].total).toBe(7);
  });

  it('jogo não terminado não conta', () => {
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
});
