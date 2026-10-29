export const PROTOCOL_VERSION = 1;
export type Seat = 0 | 1;
export interface InputState { left: boolean; right: boolean; jump: boolean; punch: boolean; block: boolean }
export interface InputIntent { seq: number; buttons: InputState }
export type FighterMode = 'idle' | 'walk' | 'jump' | 'fall' | 'attack' | 'block' | 'hitstun' | 'knockout';
export interface FighterState {
  seat: Seat;
  x: number;
  y: number;
  velocityY: number;
  facing: -1 | 1;
  hp: number;
  guard: number;
  mode: FighterMode;
  attack: { age: number; hit: boolean; direction: -1 | 1 } | null;
  stunTicks: number;
  input: InputState;
  punchQueued: boolean;
  jumpQueued: boolean;
}
export interface RoundResult { round: number; winner: Seat | 'draw'; reason: 'ko' | 'double_ko' }
export interface GameState {
  matchId: string;
  tick: number;
  round: number;
  phase: 'waiting' | 'countdown' | 'active' | 'round_end' | 'ended';
  phaseTicks: number;
  fighters: [FighterState, FighterState];
  result: RoundResult | null;
  roundWins: [number, number];
  endReason: 'opponent_left' | 'room_expired' | null;
}
export interface Snapshot extends GameState { protocol: typeof PROTOCOL_VERSION; roomCode: string }
export type ErrorCode = 'ROOM_FULL' | 'ROOM_NOT_FOUND' | 'ALREADY_SEATED' | 'INVALID_INPUT' | 'INVALID_ROOM' | 'INVALID_SEAT' | 'STALE_INPUT' | 'RATE_LIMITED' | 'SERVER_FULL';
export interface GameError { code: ErrorCode; message: string }
export interface SeatAssignment { roomCode: string; matchId: string; seat: Seat; seatToken: string }
export type Reply<T> = { ok: true; value: T } | { ok: false; error: GameError };
export type Ack<T> = (reply: Reply<T>) => void;
export interface ClientToServerEvents {
  'room:create': (ack: Ack<SeatAssignment>) => void;
  'room:join': (payload: { code: string }, ack: Ack<SeatAssignment>) => void;
  'room:leave': (ack: Ack<null>) => void;
  input: (payload: InputIntent, ack?: Ack<null>) => void;
}
export interface ServerToClientEvents {
  snapshot: (snapshot: Snapshot) => void;
  'game:error': (error: GameError) => void;
}
