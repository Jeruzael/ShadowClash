import { BALANCE as B } from './balance.js';
import type { FighterState, GameState, InputState, Seat } from './protocol.js';

export const emptyInput = (): InputState => ({ left: false, right: false, jump: false, punch: false, block: false });

function fighter(seat: Seat): FighterState {
  return { seat, x: B.spawnX[seat], y: B.floorY, velocityY: 0, facing: seat === 0 ? 1 : -1,
    hp: B.maxHp, guard: B.maxGuard, mode: 'idle', attack: null, stunTicks: 0,
    input: emptyInput(), punchQueued: false, jumpQueued: false };
}

export function createGame(matchId: string): GameState {
  return { matchId, tick: 0, round: 1, phase: 'waiting', phaseTicks: 0,
    fighters: [fighter(0), fighter(1)], result: null, roundWins: [0, 0], endReason: null };
}

export function startGame(game: GameState): void {
  if (game.phase !== 'waiting') return;
  game.phase = 'countdown';
  game.phaseTicks = B.countdownTicks;
}

// Server derives edges from ordered held-button packets. Latching preserves a
// press/release arriving between simulation ticks, without repeating held J.
export function applyInput(game: GameState, seat: Seat, input: InputState): void {
  const f = game.fighters[seat];
  if (game.phase === 'active') {
    f.punchQueued ||= input.punch && !f.input.punch;
    f.jumpQueued ||= input.jump && !f.input.jump;
  }
  f.input = { ...input };
}

function clearControls(game: GameState): void {
  for (const f of game.fighters) {
    f.input = emptyInput();
    f.punchQueued = false;
    f.jumpQueued = false;
  }
}

function moveFighter(f: FighterState): void {
  const grounded = f.y === B.floorY;
  if (f.stunTicks > 0) {
    f.stunTicks--;
    f.mode = 'hitstun';
    f.attack = null;
  } else if (f.attack) {
    f.mode = 'attack';
    f.attack.age++;
    const duration = B.punch.startupTicks + B.punch.activeTicks + B.punch.recoveryTicks;
    if (f.attack.age >= duration) { f.attack = null; f.mode = 'idle'; }
  } else if (grounded && f.input.block && f.guard > 0) {
    f.mode = 'block';
  } else if (grounded && f.jumpQueued && !f.input.block) {
    f.velocityY = B.jumpVelocity;
    f.mode = 'jump';
  } else if (grounded && f.punchQueued && !f.input.block) {
    f.attack = { age: 0, hit: false, direction: f.facing };
    f.mode = 'attack';
  } else {
    const axis = Number(f.input.right) - Number(f.input.left);
    f.x += axis * B.movePerTick;
    f.mode = grounded ? (axis === 0 ? 'idle' : 'walk') : (f.velocityY < 0 ? 'jump' : 'fall');
  }
  f.x = Math.max(B.minX, Math.min(B.maxX, f.x));
  if (f.y < B.floorY || f.velocityY < 0) {
    f.velocityY += B.gravityPerTick;
    f.y = Math.min(B.floorY, f.y + f.velocityY);
    if (f.y === B.floorY) f.velocityY = 0;
  }
  f.punchQueued = false;
  f.jumpQueued = false;
}

function separateBodies(a: FighterState, b: FighterState): void {
  if (Math.abs(a.y - b.y) >= B.fighterHeight) return;
  const gap = Math.abs(b.x - a.x);
  if (gap >= B.fighterWidth) return;
  const direction = b.x >= a.x ? 1 : -1;
  const push = (B.fighterWidth - gap) / 2;
  a.x = Math.max(B.minX, Math.min(B.maxX, a.x - direction * push));
  b.x = Math.max(B.minX, Math.min(B.maxX, b.x + direction * push));
  // Transfer any remaining overlap to the fighter away from the wall.
  const remaining = B.fighterWidth - Math.abs(b.x - a.x);
  if (remaining > 0) {
    if (a.x === B.minX || a.x === B.maxX) b.x += direction * remaining;
    else a.x -= direction * remaining;
  }
}

function canHit(attacker: FighterState, defender: FighterState): boolean {
  const attack = attacker.attack;
  if (!attack || attack.hit || attack.age < B.punch.startupTicks || attack.age >= B.punch.startupTicks + B.punch.activeTicks) return false;
  const distance = (defender.x - attacker.x) * attack.direction;
  const centerY = attacker.y - B.fighterHeight * 0.6;
  return distance >= 0 && distance <= B.fighterWidth + B.punch.reach
    && centerY + B.punch.height / 2 > defender.y - B.fighterHeight
    && centerY - B.punch.height / 2 < defender.y;
}

export function stepGame(game: GameState): void {
  if (game.phase === 'ended') return;
  game.tick++;
  if (game.phase === 'waiting') return;
  if (game.phase === 'countdown' || game.phase === 'round_end') {
    game.phaseTicks--;
    if (game.phaseTicks <= 0) {
      if (game.phase === 'round_end') {
        game.round++;
        game.fighters = [fighter(0), fighter(1)];
        game.phase = 'countdown';
        game.phaseTicks = B.countdownTicks;
      } else {
        game.phase = 'active';
        clearControls(game);
      }
    }
    return;
  }
  const [a, b] = game.fighters;
  a.facing = b.x >= a.x ? 1 : -1;
  b.facing = a.x >= b.x ? 1 : -1;
  for (const f of game.fighters) moveFighter(f);
  separateBodies(a, b);

  // Determine both contacts before mutating health/stun, so socket or seat
  // ordering never changes the outcome of simultaneous punches.
  const hits = [canHit(a, b), canHit(b, a)];
  for (const seat of [0, 1] as const) {
    if (!hits[seat]) continue;
    const attacker = game.fighters[seat];
    const target = game.fighters[seat === 0 ? 1 : 0];
    if (attacker.attack) attacker.attack.hit = true;
    const inFront = (attacker.x - target.x) * target.facing >= 0;
    if (target.mode === 'block' && target.y === B.floorY && inFront && target.guard > 0) {
      target.guard = Math.max(0, target.guard - B.punch.guardDamage);
    } else {
      target.hp = Math.max(0, target.hp - B.punch.damage);
      target.stunTicks = B.hitstunTicks;
      target.mode = target.hp === 0 ? 'knockout' : 'hitstun';
    }
  }
  if (a.hp === 0 || b.hp === 0) {
    const winner = a.hp === 0 && b.hp === 0 ? 'draw' : a.hp > 0 ? 0 : 1;
    game.result = { round: game.round, winner, reason: winner === 'draw' ? 'double_ko' : 'ko' };
    if (winner !== 'draw') game.roundWins[winner]++;
    game.phase = 'round_end';
    game.phaseTicks = B.resultTicks;
    for (const f of game.fighters) { f.attack = null; if (f.hp === 0) f.mode = 'knockout'; }
    clearControls(game);
  }
}
