import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Server } from 'socket.io';
import {
  BALANCE as B, PROTOCOL_VERSION, applyInput, createGame, emptyInput, startGame, stepGame,
  type ClientToServerEvents, type ErrorCode, type GameState, type InputIntent,
  type Seat, type ServerToClientEvents,
} from '@shadow-clash/shared';

export interface ServerOptions { roomIdleMs?: number; maxRooms?: number; allowedOrigins?: string[] }
interface Bucket { tokens: number; time: number }
interface SocketData { room?: string; seat?: Seat; inputBucket: Bucket; roomBucket: Bucket }
interface Room {
  code: string;
  game: GameState;
  sockets: [string | null, string | null];
  sequences: [number, number];
  inputTicks: [number, number];
  created: number;
  activity: number;
  ended: number | null;
}
const MESSAGES: Record<ErrorCode, string> = {
  ROOM_FULL: 'Room full. This fight already has two players.', ROOM_NOT_FOUND: 'Room not found or closed. Create a new fight.',
  ALREADY_SEATED: 'Leave your current room before joining another.', INVALID_INPUT: 'Invalid input message.',
  INVALID_ROOM: 'Enter an eight-character room code.', INVALID_SEAT: 'Join a room before sending controls.',
  STALE_INPUT: 'Outdated input discarded.', RATE_LIMITED: 'Too many requests. Please slow down.', SERVER_FULL: 'Server full. Try again shortly.',
};
function spend(bucket: Bucket, capacity: number, refill: number): boolean {
  const now = performance.now();
  bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.time) / 1000 * refill);
  bucket.time = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens--;
  return true;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validInput(value: unknown): value is InputIntent {
  if (!record(value) || Object.keys(value).length !== 2 || !Number.isSafeInteger(value.seq)
    || (value.seq as number) < 1 || (value.seq as number) > 2147483647 || !record(value.buttons)) return false;
  const keys = ['left', 'right', 'jump', 'punch', 'block'];
  return Object.keys(value.buttons).length === keys.length && keys.every(key => typeof (value.buttons as Record<string, unknown>)[key] === 'boolean');
}

export function createGameServer(options: ServerOptions = {}) {
  const rooms = new Map<string, Room>();
  const origins = options.allowedOrigins ?? ['http://127.0.0.1:5173', 'http://localhost:5173'];
  const httpServer = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/health' && request.method === 'GET') {
      response.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, rooms: rooms.size }));
    } else { response.statusCode = 404; response.end(JSON.stringify({ error: 'NOT_FOUND' })); }
  });
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: origins }, maxHttpBufferSize: 1024,
    allowRequest: (request, done) => done(null, !request.headers.origin || origins.includes(request.headers.origin)),
  });
  type GameSocket = Parameters<Parameters<typeof io.on<'connection'>>[1]>[0];
  function fail(socket: GameSocket, code: ErrorCode, ack?: unknown) {
    const error = { code, message: MESSAGES[code] };
    if (typeof ack === 'function') ack({ ok: false, error });
    else socket.emit('game:error', error);
  }
  function reply(ack: unknown, value: unknown) { if (typeof ack === 'function') ack({ ok: true, value }); }
  function broadcast(room: Room) {
    io.to(room.code).emit('snapshot', { ...room.game, protocol: PROTOCOL_VERSION, roomCode: room.code });
  }
  function expire(code: string) {
    const room = rooms.get(code);
    if (!room) return;
    for (const id of room.sockets) {
      const socket = id ? io.sockets.sockets.get(id) : undefined;
      if (!socket) continue;
      socket.leave(code);
      delete socket.data.room;
      delete socket.data.seat;
    }
    rooms.delete(code);
  }
  function detach(socket: GameSocket) {
    const { room: code, seat } = socket.data;
    if (!code || seat === undefined) return;
    const room = rooms.get(code);
    socket.leave(code);
    delete socket.data.room;
    delete socket.data.seat;
    if (!room || room.sockets[seat] !== socket.id) return;
    room.sockets[seat] = null;
    room.game.phase = 'ended';
    room.game.endReason = 'opponent_left';
    room.ended = Date.now();
    for (const fighter of room.game.fighters) {
      fighter.input = emptyInput(); fighter.punchQueued = false; fighter.jumpQueued = false;
    }
    broadcast(room);
    if (room.sockets.every(id => id === null)) expire(code);
  }
  function assign(socket: GameSocket, room: Room, seat: Seat, ack: unknown) {
    room.sockets[seat] = socket.id;
    socket.data.room = room.code;
    socket.data.seat = seat;
    socket.join(room.code);
    // M1 issues an unguessable per-seat receipt. No client can submit this to
    // replace a seat: token-based reconnection is intentionally an M2 feature.
    reply(ack, { roomCode: room.code, matchId: room.game.matchId, seat, seatToken: randomBytes(32).toString('hex') });
    if (seat === 1) startGame(room.game);
    broadcast(room);
  }
  io.use((_socket, next) => {
    if (io.engine.clientsCount > 512) next(new Error('Server connection limit reached.'));
    else next();
  });
  io.on('connection', socket => {
    socket.data.inputBucket = { tokens: 45, time: performance.now() };
    socket.data.roomBucket = { tokens: 12, time: performance.now() };
    socket.on('room:create', ack => {
      if (!spend(socket.data.roomBucket, 12, 3)) return fail(socket, 'RATE_LIMITED', ack);
      if (typeof ack !== 'function') return fail(socket, 'INVALID_INPUT');
      if (socket.data.room) return fail(socket, 'ALREADY_SEATED', ack);
      if (rooms.size >= (options.maxRooms ?? 128)) return fail(socket, 'SERVER_FULL', ack);
      let code: string;
      do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
      const now = Date.now();
      const room: Room = { code, game: createGame(randomBytes(16).toString('hex')), sockets: [null, null],
        sequences: [0, 0], inputTicks: [0, 0], created: now, activity: now, ended: null };
      rooms.set(code, room);
      assign(socket, room, 0, ack);
    });
    socket.on('room:join', (payload: unknown, ack) => {
      if (!spend(socket.data.roomBucket, 12, 3)) return fail(socket, 'RATE_LIMITED', ack);
      if (typeof ack !== 'function') return fail(socket, 'INVALID_INPUT');
      if (socket.data.room) return fail(socket, 'ALREADY_SEATED', ack);
      if (!record(payload) || Object.keys(payload).length !== 1 || typeof payload.code !== 'string' || !/^[A-Z0-9]{8}$/.test(payload.code)) return fail(socket, 'INVALID_ROOM', ack);
      const room = rooms.get(payload.code);
      if (!room || room.game.phase === 'ended') return fail(socket, 'ROOM_NOT_FOUND', ack);
      if (room.sockets[1]) return fail(socket, 'ROOM_FULL', ack);
      assign(socket, room, 1, ack);
    });
    socket.on('input', (payload: unknown, ack) => {
      if (!spend(socket.data.inputBucket, 45, 90)) return fail(socket, 'RATE_LIMITED', ack);
      if (!validInput(payload)) return fail(socket, 'INVALID_INPUT', ack);
      const { room: code, seat } = socket.data;
      const room = code ? rooms.get(code) : undefined;
      if (!room || seat === undefined || room.sockets[seat] !== socket.id || room.game.phase === 'ended') return fail(socket, 'INVALID_SEAT', ack);
      if (payload.seq <= room.sequences[seat]) return fail(socket, 'STALE_INPUT', ack);
      room.sequences[seat] = payload.seq;
      room.inputTicks[seat] = room.game.tick;
      room.activity = Date.now();
      applyInput(room.game, seat, payload.buttons);
      reply(ack, null);
    });
    socket.on('room:leave', ack => { detach(socket); reply(ack, null); });
    socket.on('disconnect', () => detach(socket));
  });

  let previous = performance.now();
  let accumulator = 0;
  const tickMs = 1000 / B.tickRate;
  const scheduler = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min(250, now - previous);
    previous = now;
    let steps = 0;
    while (accumulator >= tickMs && steps < 5) {
      accumulator -= tickMs;
      steps++;
      for (const room of rooms.values()) {
        for (const seat of [0, 1] as const) {
          if (room.game.tick - room.inputTicks[seat] > 30) applyInput(room.game, seat, emptyInput());
        }
        const before = room.game.phase;
        stepGame(room.game);
        if (room.game.tick % B.snapshotEveryTicks === 0 || room.game.phase !== before) broadcast(room);
      }
    }
    if (steps === 5) accumulator %= tickMs;
    const wallTime = Date.now();
    for (const room of rooms.values()) {
      if (room.ended !== null && wallTime - room.ended > 30000) expire(room.code);
      else if (room.game.phase !== 'ended' && (wallTime - room.activity > (options.roomIdleMs ?? 60000) || wallTime - room.created > 3600000)) {
        room.game.phase = 'ended'; room.game.endReason = 'room_expired'; room.ended = wallTime;
        broadcast(room);
        expire(room.code);
      }
    }
  }, 4);
  let closed = false;
  return { httpServer, io, close: () => new Promise<void>(resolve => {
    if (closed) { resolve(); return; }
    closed = true;
    clearInterval(scheduler);
    io.close(() => { rooms.clear(); resolve(); });
  }) };
}
