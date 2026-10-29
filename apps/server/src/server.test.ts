import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { emptyInput, type InputIntent, type Reply, type SeatAssignment, type Snapshot } from '@shadow-clash/shared';
import { createGameServer } from './server.js';

let server: ReturnType<typeof createGameServer>;
let url: string;
const clients: Socket[] = [];

async function connect() {
  const client = io(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  clients.push(client);
  await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
  return client;
}
const create = (client: Socket) => new Promise<Reply<SeatAssignment>>(resolve => client.emit('room:create', resolve));
const join = (client: Socket, code: string) => new Promise<Reply<SeatAssignment>>(resolve => client.emit('room:join', { code }, resolve));
const send = (client: Socket, payload: unknown) => new Promise<Reply<null>>(resolve => client.emit('input', payload, resolve));
function value<T>(reply: Reply<T>): T {
  expect(reply.ok).toBe(true);
  if (!reply.ok) throw new Error(reply.error.code);
  return reply.value;
}
function snapshot(client: Socket, predicate: (state: Snapshot) => boolean = () => true) {
  return new Promise<Snapshot>((resolve, reject) => {
    const timeout = setTimeout(() => { client.off('snapshot', onState); reject(new Error('No matching snapshot')); }, 4000);
    function onState(state: Snapshot) {
      if (!predicate(state)) return;
      clearTimeout(timeout); client.off('snapshot', onState); resolve(state);
    }
    client.on('snapshot', onState);
  });
}

beforeEach(async () => {
  server = createGameServer({ roomIdleMs: 10000 });
  await new Promise<void>(resolve => server.httpServer.listen(0, '127.0.0.1', resolve));
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing TCP listener');
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { for (const client of clients.splice(0)) client.disconnect(); await server.close(); });

describe('real socket rooms', () => {
  it('allocates White then Black, unique credentials, and rejects a third client', async () => {
    const a = await connect(), b = await connect(), c = await connect();
    const first = value(await create(a));
    const second = value(await join(b, first.roomCode));
    expect(first.roomCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(first.seat).toBe(0);
    expect(second.seat).toBe(1);
    expect(second.matchId).toBe(first.matchId);
    expect(first.seatToken).toHaveLength(64);
    expect(second.seatToken).not.toBe(first.seatToken);
    expect(await join(c, first.roomCode)).toMatchObject({ ok: false, error: { code: 'ROOM_FULL' } });
  });

  it('rejects duplicate seat requests without creating another room', async () => {
    const a = await connect();
    const first = value(await create(a));
    expect(await create(a)).toMatchObject({ ok: false, error: { code: 'ALREADY_SEATED' } });
    expect(await join(a, first.roomCode)).toMatchObject({ ok: false, error: { code: 'ALREADY_SEATED' } });
    const health = await fetch(`${url}/health`).then(r => r.json());
    expect(health).toMatchObject({ ok: true, rooms: 1 });
  });

  it('validates room codes and handles missing acknowledgements without crashing', async () => {
    const a = await connect();
    a.emit('room:create');
    a.emit('room:join', null);
    a.emit('room:leave');
    expect(await join(a, 'x'.repeat(100))).toMatchObject({ ok: false, error: { code: 'INVALID_ROOM' } });
    expect(await join(a, 'ABCDEFGH')).toMatchObject({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });
    expect((await create(a)).ok).toBe(true);
  });

  it('validates exact input shape, finite sequence IDs and socket seat ownership', async () => {
    const a = await connect(), outsider = await connect();
    value(await create(a));
    const invalid = [null, {}, { seq: NaN, buttons: emptyInput() }, { seq: -1, buttons: emptyInput() },
      { seq: 1.5, buttons: emptyInput() }, { seq: 1, buttons: { ...emptyInput(), left: 1 } },
      { seq: 1, buttons: emptyInput(), hp: 0 }, { seq: 1, buttons: { ...emptyInput(), damage: 100 } },
      { seq: Number.MAX_SAFE_INTEGER, buttons: emptyInput() }];
    for (const payload of invalid) expect(await send(a, payload)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(await send(outsider, { seq: 1, buttons: emptyInput() })).toMatchObject({ ok: false, error: { code: 'INVALID_SEAT' } });
    expect(await send(a, { seq: 1, buttons: emptyInput() })).toMatchObject({ ok: true });
    expect(await send(a, { seq: 1, buttons: emptyInput() })).toMatchObject({ ok: false, error: { code: 'STALE_INPUT' } });
  });

  it('bounds input bursts', async () => {
    const a = await connect();
    value(await create(a));
    const replies = await Promise.all(Array.from({ length: 160 }, (_, i) => send(a, { seq: i + 1, buttons: emptyInput() })));
    expect(replies.some(r => !r.ok && r.error.code === 'RATE_LIMITED')).toBe(true);
    expect((await fetch(`${url}/health`)).status).toBe(200);
  });

  it('moves only the sender seat and ignores forged health/damage events', async () => {
    const a = await connect(), b = await connect();
    const first = value(await create(a));
    value(await join(b, first.roomCode));
    await snapshot(a, s => s.phase === 'active');
    expect(await send(a, { seq: 1, buttons: { ...emptyInput(), right: true } })).toMatchObject({ ok: true });
    a.emit('health', { seat: 1, hp: 0 });
    a.emit('damage', { damage: 10000 });
    const state = await snapshot(b, s => s.fighters[0].x > 415);
    expect(state.fighters[1].x).toBe(880);
    expect(state.fighters.map(f => f.hp)).toEqual([100, 100]);
    expect(state.matchId).toBe(first.matchId);
  });

  it('expires stale held input when a client stops sending heartbeats', async () => {
    const a = await connect(), b = await connect();
    const first = value(await create(a));
    value(await join(b, first.roomCode));
    const active = await snapshot(a, s => s.phase === 'active');
    await send(a, { seq: 1, buttons: { ...emptyInput(), left: true } } satisfies InputIntent);
    const stopped = await snapshot(a, s => s.tick > active.tick + 40);
    const later = await snapshot(a, s => s.tick > stopped.tick + 15);
    expect(stopped.fighters[0].x).toBeLessThan(400);
    expect(later.fighters[0].x).toBe(stopped.fighters[0].x);
  });

  it('isolates snapshots and inputs between separate rooms', async () => {
    const a = await connect(), b = await connect(), c = await connect();
    const first = value(await create(a));
    value(await join(b, first.roomCode));
    const other = value(await create(c));
    await snapshot(a, s => s.phase === 'active');
    await send(a, { seq: 1, buttons: { ...emptyInput(), right: true } });
    const roomC = await snapshot(c);
    expect(roomC.matchId).toBe(other.matchId);
    expect(roomC.matchId).not.toBe(first.matchId);
    expect(roomC.phase).toBe('waiting');
    expect(roomC.fighters[0].x).toBe(400);
  });

  it('ends the room safely on disconnect and rejects seat replacement', async () => {
    const a = await connect(), b = await connect(), c = await connect();
    const first = value(await create(a));
    value(await join(b, first.roomCode));
    await snapshot(a, s => s.phase === 'active');
    const ended = snapshot(a, s => s.phase === 'ended');
    b.disconnect();
    expect((await ended).endReason).toBe('opponent_left');
    expect(await join(c, first.roomCode)).toMatchObject({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });
    expect((await fetch(`${url}/health`)).status).toBe(200);
    await new Promise<void>(resolve => a.emit('room:leave', () => resolve()));
    expect((await create(a)).ok).toBe(true);
  });

  it('caps room resources and reclaims empty rooms', async () => {
    await server.close();
    server = createGameServer({ maxRooms: 1 });
    await new Promise<void>(resolve => server.httpServer.listen(0, '127.0.0.1', resolve));
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing address');
    url = `http://127.0.0.1:${address.port}`;
    const a = await connect(), b = await connect();
    value(await create(a));
    expect(await create(b)).toMatchObject({ ok: false, error: { code: 'SERVER_FULL' } });
    await new Promise<void>(resolve => a.emit('room:leave', () => resolve()));
    expect((await create(b)).ok).toBe(true);
  });

  it('closes oversized messages without crashing or leaving an occupied room', async () => {
    const a = await connect();
    value(await create(a));
    const disconnected = new Promise<void>(resolve => a.once('disconnect', () => resolve()));
    a.emit('input', { seq: 1, buttons: emptyInput(), padding: 'x'.repeat(2048) });
    await disconnected;
    const health = await fetch(`${url}/health`).then(r => r.json());
    expect(health).toMatchObject({ ok: true, rooms: 0 });
  });

  it('rejects an unapproved browser origin', async () => {
    const a = io(url, { transports: ['websocket'], reconnection: false, extraHeaders: { Origin: 'https://unapproved.invalid' } });
    clients.push(a);
    const rejected = await new Promise<Error>(resolve => a.once('connect_error', resolve));
    expect(rejected).toBeInstanceOf(Error);
    expect(a.connected).toBe(false);
  });

  it('expires idle rooms and frees membership for a new fight', async () => {
    await server.close();
    server = createGameServer({ roomIdleMs: 100 });
    await new Promise<void>(resolve => server.httpServer.listen(0, '127.0.0.1', resolve));
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing address');
    url = `http://127.0.0.1:${address.port}`;
    const a = await connect();
    value(await create(a));
    const ended = await snapshot(a, s => s.phase === 'ended');
    expect(ended.endReason).toBe('room_expired');
    expect(await fetch(`${url}/health`).then(r => r.json())).toMatchObject({ rooms: 0 });
    expect((await create(a)).ok).toBe(true);
  });
});
