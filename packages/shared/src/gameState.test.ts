import { describe, expect, it } from 'vitest';
import { applyInput, createGame, emptyInput, startGame, stepGame } from './gameState.js';

function advance(game: ReturnType<typeof createGame>, ticks: number) {
  for (let i = 0; i < ticks; i++) stepGame(game);
}

function fight() {
  const game = createGame('test-match');
  startGame(game);
  advance(game, 90);
  expect(game.phase).toBe('active');
  return game;
}

function punch(game: ReturnType<typeof createGame>, seat: 0 | 1 = 0) {
  applyInput(game, seat, { ...emptyInput(), punch: true });
  advance(game, 10);
  applyInput(game, seat, emptyInput());
  advance(game, 30);
}

describe('authoritative combat', () => {
  it('moves only the selected fighter and clamps arena bounds', () => {
    const game = fight();
    applyInput(game, 0, { ...emptyInput(), left: true });
    advance(game, 600);
    expect(game.fighters[0].x).toBe(40);
    expect(game.fighters[1].x).toBe(880);
    expect(game.fighters[0].facing).toBe(1);
  });

  it('keeps opposing grounded bodies from passing through each other', () => {
    const game = fight();
    applyInput(game, 0, { ...emptyInput(), right: true });
    applyInput(game, 1, { ...emptyInput(), left: true });
    advance(game, 200);
    expect(game.fighters[1].x - game.fighters[0].x).toBeGreaterThanOrEqual(48);
    expect(game.fighters[0].facing).toBe(1);
    expect(game.fighters[1].facing).toBe(-1);
  });

  it('jumps under gravity, lands, and does not repeatedly jump while held', () => {
    const game = fight();
    applyInput(game, 0, { ...emptyInput(), jump: true });
    advance(game, 8);
    expect(game.fighters[0].y).toBeLessThan(600);
    advance(game, 150);
    expect(game.fighters[0].y).toBe(600);
    expect(game.fighters[0].velocityY).toBe(0);
  });

  it('misses outside punch range', () => {
    const game = fight();
    punch(game);
    expect(game.fighters[1].hp).toBe(100);
  });

  it('has startup and registers only one hit across active frames', () => {
    const game = fight();
    game.fighters[1].x = 488;
    applyInput(game, 0, { ...emptyInput(), punch: true });
    advance(game, 4);
    expect(game.fighters[1].hp).toBe(100);
    advance(game, 20);
    expect(game.fighters[1].hp).toBe(95);
    advance(game, 100);
    expect(game.fighters[1].hp).toBe(95);
  });

  it('preserves a quick press/release received between ticks', () => {
    const game = fight();
    game.fighters[1].x = 488;
    applyInput(game, 0, { ...emptyInput(), punch: true });
    applyInput(game, 0, emptyInput());
    advance(game, 24);
    expect(game.fighters[1].hp).toBe(95);
  });

  it('requires a released button before accepting another punch', () => {
    const game = fight();
    game.fighters[1].x = 488;
    punch(game);
    punch(game);
    expect(game.fighters[1].hp).toBe(90);
  });

  it('blocks a front punch with guard instead of health and cannot attack while blocking', () => {
    const game = fight();
    game.fighters[1].x = 488;
    applyInput(game, 1, { ...emptyInput(), block: true, punch: true });
    punch(game);
    expect(game.fighters[1].hp).toBe(100);
    expect(game.fighters[1].guard).toBe(82);
    expect(game.fighters[0].hp).toBe(100);
  });

  it('does not block or take a ground punch while jumping above the hitbox', () => {
    const game = fight();
    game.fighters[1].x = 488;
    applyInput(game, 1, { ...emptyInput(), jump: true });
    advance(game, 18);
    applyInput(game, 1, { ...emptyInput(), block: true });
    punch(game);
    expect(game.fighters[1].hp).toBe(100);
    expect(game.fighters[1].guard).toBe(100);
  });

  it('clamps KO health, freezes actions, records one winner and resets both fighters', () => {
    const game = fight();
    game.fighters[1].x = 488;
    game.fighters[1].hp = 3;
    punch(game);
    expect(game.phase).toBe('round_end');
    expect(game.fighters[1].hp).toBe(0);
    expect(game.result).toEqual({ round: 1, winner: 0, reason: 'ko' });
    applyInput(game, 1, { ...emptyInput(), punch: true, left: true });
    advance(game, 10);
    expect(game.fighters[0].hp).toBe(100);
    advance(game, 250);
    expect(game.phase).toBe('active');
    expect(game.round).toBe(2);
    expect(game.fighters.map(f => f.hp)).toEqual([100, 100]);
    expect(game.fighters.map(f => f.x)).toEqual([400, 880]);
    expect(game.roundWins).toEqual([1, 0]);
    expect(game.result?.winner).toBe(0);
  });

  it('resolves simultaneous lethal punches as one drawn round', () => {
    const game = fight();
    game.fighters[1].x = 488;
    for (const fighter of game.fighters) fighter.hp = 5;
    applyInput(game, 0, { ...emptyInput(), punch: true });
    applyInput(game, 1, { ...emptyInput(), punch: true });
    advance(game, 10);
    expect(game.result).toEqual({ round: 1, winner: 'draw', reason: 'double_ko' });
    expect(game.roundWins).toEqual([0, 0]);
  });

  it('does not attack in the air or cancel an attack with held block', () => {
    const game = fight();
    game.fighters[1].x = 488;
    applyInput(game, 0, { ...emptyInput(), jump: true });
    advance(game, 3);
    applyInput(game, 0, { ...emptyInput(), punch: true });
    advance(game, 10);
    expect(game.fighters[0].attack).toBeNull();
    expect(game.fighters[1].hp).toBe(100);
  });
});
