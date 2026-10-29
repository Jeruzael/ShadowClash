import Phaser from 'phaser';
import { io, type Socket } from 'socket.io-client';
import {
  BALANCE as B, PROTOCOL_VERSION, emptyInput,
  type ClientToServerEvents, type InputState, type Reply, type SeatAssignment,
  type ServerToClientEvents, type Snapshot,
} from '@shadow-clash/shared';
import { FightScene } from './scene.js';
import type { ClientTestObserver } from './testObserver.js';
import './style.css';

document.querySelector('#app')!.innerHTML = `
  <header><div><p class="eyebrow">M0 / M1 · PRIVATE 1V1</p><h1>SHADOW <span>CLASH</span></h1></div><p id="connection" role="status">Connecting…</p></header>
  <section class="lobby" aria-label="Private fight">
    <div><h2>Fight a friend</h2><p>Create a room. Share the code. Each player uses their own browser.</p></div>
    <div class="room-actions"><button id="create" disabled>Fight a Friend</button>
    <form id="join-form"><label for="join-code">Room code</label><input id="join-code" name="room" maxlength="8" autocomplete="off" spellcheck="false" placeholder="8-character code" required pattern="[A-Za-z0-9]{8}"><button id="join" disabled>Join room</button></form></div>
    <p id="error" role="alert" hidden></p>
  </section>
  <section class="room-strip" aria-label="Room details"><p>ROOM <strong id="room-code">—</strong></p><p id="your-seat">Choose a room to play</p><button id="leave" class="secondary" disabled>Leave room</button></section>
  <div id="invite" hidden><label for="invite-link">Invite link</label><input id="invite-link" readonly><button id="copy" class="secondary">Copy link</button><span id="copy-status" role="status"></span></div>
  <section class="hud" aria-label="Fighter status">${[0, 1].map(seat => `
    <div class="fighter-card p${seat + 1}" id="fighter-${seat}" data-x="${B.spawnX[seat]}" data-y="600" data-mode="idle">
      <h2>P${seat + 1} · ${seat === 0 ? 'White' : 'Black'} Ninja</h2>
      <div class="meter-label"><label for="health-bar-${seat}">Health</label><span><b id="hp-${seat}">100</b> / 100</span></div>
      <progress id="health-bar-${seat}" max="100" value="100"></progress>
      <div class="meter-label guard"><label for="guard-bar-${seat}">Guard</label><span id="guard-${seat}">100</span></div>
      <progress class="guard-bar" id="guard-bar-${seat}" max="100" value="100"></progress>
    </div>`).join('')}
  </section>
  <div class="round-strip"><strong id="round-status" role="status">Create or join a private fight</strong><span>ROUND <b id="round-number">1</b> · WINS <span id="wins">0 – 0</span></span></div>
  <div id="arena" tabindex="0" role="application" aria-label="Shadow Clash arena. A and D move, W jump, J punch, L block."></div>
  <p class="controls"><kbd>A</kbd><kbd>D</kbd> Move <kbd>W</kbd> Jump <kbd>J</kbd> Punch <kbd>L</kbd> Hold to block <span>Click the arena to focus · Release J between punches</span></p>
  <footer><p id="round-result">Server decides all movement, hits and results.</p><p>Match <code id="match-id">—</code> · Tick <span id="tick">0</span></p></footer>
`;

function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(import.meta.env.VITE_SERVER_URL || undefined, { autoConnect: false });
let assignment: SeatAssignment | null = null;
let latest: Snapshot | null = null;
let held = emptyInput();
let seq = 0;
let pending = false;
const history: Snapshot[] = [];
// No test messages are trusted by the server. This observer is tree-shaken
// entirely out of normal dev/production bundles.
if (import.meta.env.MODE === 'test') {
  const observer: ClientTestObserver = { socket: socket as Socket, history };
  window.__SC_TEST__ = observer;
}

function buttons() {
  el<HTMLButtonElement>('create').disabled = !socket.connected || pending || assignment !== null;
  el<HTMLButtonElement>('join').disabled = !socket.connected || pending || assignment !== null;
  el<HTMLInputElement>('join-code').disabled = pending || assignment !== null;
  el<HTMLButtonElement>('leave').disabled = !assignment || pending;
}
function error(message = '') { el('error').textContent = message; el('error').hidden = !message; }
function sendHeld() {
  if (!socket.connected || !assignment || latest?.phase === 'ended') return;
  socket.emit('input', { seq: ++seq, buttons: { ...held } });
}
function release() { held = emptyInput(); sendHeld(); }
function clearRoom() {
  assignment = null; latest = null; held = emptyInput(); pending = false;
  sessionStorage.removeItem('shadow-clash-seat');
  el('your-seat').textContent = 'Choose a room to play'; el('room-code').textContent = '—';
  el('invite').hidden = true;
  el('round-status').textContent = 'Create or join a private fight';
  buttons();
}
function accept(reply: Reply<SeatAssignment>) {
  pending = false;
  if (!reply.ok) { error(reply.error.message); buttons(); return; }
  assignment = reply.value; seq = 0; held = emptyInput(); history.length = 0;
  sessionStorage.setItem('shadow-clash-seat', JSON.stringify(assignment));
  el('room-code').textContent = assignment.roomCode;
  el('your-seat').textContent = assignment.seat === 0 ? 'P1 · White Ninja' : 'P2 · Black Ninja';
  el('invite').hidden = false;
  const link = new URL(location.href); link.search = ''; link.searchParams.set('room', assignment.roomCode);
  el<HTMLInputElement>('invite-link').value = link.href;
  el('arena').focus(); error(); buttons();
}
function request(code?: string) {
  if (pending || assignment || !socket.connected) return;
  pending = true; error(); buttons();
  const done = (err: Error | null, reply: Reply<SeatAssignment>) => {
    if (err) { pending = false; error('Request timed out. Reconnect before trying again.'); socket.disconnect(); socket.connect(); buttons(); }
    else accept(reply);
  };
  if (code) socket.timeout(4000).emit('room:join', { code }, done);
  else socket.timeout(4000).emit('room:create', done);
}
el('create').addEventListener('click', () => request());
el('join-form').addEventListener('submit', event => { event.preventDefault(); request(el<HTMLInputElement>('join-code').value.trim().toUpperCase()); });
el('leave').addEventListener('click', () => {
  release(); pending = true; buttons();
  socket.timeout(4000).emit('room:leave', (err: Error | null) => {
    clearRoom();
    if (err) { socket.disconnect(); socket.connect(); error('Connection interrupted. The room was closed.'); }
  });
});
el('copy').addEventListener('click', () => {
  const input = el<HTMLInputElement>('invite-link');
  void navigator.clipboard.writeText(input.value).then(() => { el('copy-status').textContent = 'Copied'; }, () => { input.select(); el('copy-status').textContent = 'Select and copy the link'; });
});
el<HTMLInputElement>('join-code').value = new URLSearchParams(location.search).get('room')?.slice(0, 8).toUpperCase() ?? '';

socket.on('connect', () => { el('connection').textContent = '● Connected'; buttons(); });
socket.on('disconnect', () => { clearRoom(); el('connection').textContent = 'Disconnected · reconnecting…'; error('Connection lost. This M1 fight has ended; create or join a new room after reconnecting.'); });
socket.on('connect_error', () => { el('connection').textContent = 'Server unavailable'; error('Could not connect. Check that the local server is running.'); buttons(); });
socket.on('game:error', failure => error(failure.message));
socket.on('snapshot', state => {
  if (!assignment || state.matchId !== assignment.matchId) return;
  if (state.protocol !== PROTOCOL_VERSION) { error('Protocol mismatch. Reload the client.'); return; }
  latest = state;
  if (import.meta.env.MODE === 'test') { history.push(state); if (history.length > 1000) history.shift(); }
  el('match-id').textContent = state.matchId; el('tick').textContent = String(state.tick);
  el('round-number').textContent = String(state.round);
  el('wins').textContent = `${state.roundWins[0]} – ${state.roundWins[1]}`;
  for (const f of state.fighters) {
    el(`hp-${f.seat}`).textContent = String(f.hp);
    el(`guard-${f.seat}`).textContent = String(f.guard);
    el<HTMLProgressElement>(`health-bar-${f.seat}`).value = f.hp;
    el<HTMLProgressElement>(`guard-bar-${f.seat}`).value = f.guard;
    const card = el(`fighter-${f.seat}`);
    card.dataset.x = String(f.x); card.dataset.y = String(f.y); card.dataset.mode = f.mode;
  }
  const result = state.result ? state.result.winner === 'draw' ? 'Draw · double KO' : `${state.result.winner === 0 ? 'White' : 'Black'} Ninja wins round ${state.result.round}` : '';
  const status = state.phase === 'waiting' ? 'Waiting for opponent…'
    : state.phase === 'countdown' ? `Get ready · ${Math.ceil(state.phaseTicks / B.tickRate)}`
    : state.phase === 'active' ? 'Fight!'
    : state.phase === 'round_end' ? `${result} · Next round soon`
    : state.endReason === 'opponent_left' ? 'Opponent left · Fight closed. Leave to start another.' : 'Room expired · Leave to start another.';
  if (el('round-status').textContent !== status) el('round-status').textContent = status;
  el('round-result').textContent = result ? `Last result: ${result}` : 'Server decides all movement, hits and results.';
});

const map: Record<string, keyof InputState> = { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyJ: 'punch', KeyL: 'block' };
function capture(event: KeyboardEvent, down: boolean) {
  const button = map[event.code];
  const target = event.target;
  if (!button || !assignment || (down && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement))) return;
  event.preventDefault();
  if (held[button] === down) return;
  held[button] = down; sendHeld();
}
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'arena', width: B.arenaWidth, height: B.arenaHeight,
  backgroundColor: '#101722', banner: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [new FightScene(() => latest, capture, release)],
});
const heartbeat = setInterval(sendHeld, 100);
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
el('arena').addEventListener('pointerdown', () => el('arena').focus());
window.addEventListener('beforeunload', () => { clearInterval(heartbeat); socket.disconnect(); game.destroy(true); });
socket.connect();
