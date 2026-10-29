import { expect, test, type Page } from '@playwright/test';
import type { Reply, Snapshot } from '@shadow-clash/shared';
import type {} from '../../apps/client/src/testObserver.js';

const hp = (page: Page, seat: number) => page.locator(`#hp-${seat}`);
const x = (page: Page, seat: number) => page.locator(`#fighter-${seat}`).getAttribute('data-x').then(Number);
type AckHarness = NonNullable<Window['__SC_TEST__']> & { releaseAck?: () => void };

async function holdRealReplyAcrossReconnect(page: Page, event: 'room:create' | 'room:leave') {
  await page.evaluate(event => {
    const observer = window.__SC_TEST__ as AckHarness;
    const socket = observer.socket;
    const emit = socket.emit;
    socket.emit = function (name: string, ...args: unknown[]) {
      if (name === event) {
        socket.emit = emit;
        const callback = args.pop();
        args.push((...reply: unknown[]) => {
          observer.releaseAck = () => { if (typeof callback === 'function') callback(...reply); delete observer.releaseAck; };
          socket.disconnect(); socket.connect();
        });
      }
      return emit.call(socket, name, ...args);
    };
  }, event);
}
async function tap(page: Page, key: string) { await page.keyboard.down(key); await page.waitForTimeout(45); await page.keyboard.up(key); }
async function punch(page: Page) { await tap(page, 'j'); await page.waitForTimeout(420); }

async function expectLobby(page: Page) {
  for (const seat of [0, 1]) {
    await expect(hp(page, seat)).toHaveText('100');
    await expect(page.locator(`#guard-${seat}`)).toHaveText('100');
    await expect(page.locator(`#health-bar-${seat}`)).toHaveJSProperty('value', 100);
    await expect(page.locator(`#guard-bar-${seat}`)).toHaveJSProperty('value', 100);
    await expect(page.locator(`#fighter-${seat}`)).toHaveAttribute('data-x', seat === 0 ? '400' : '880');
    await expect(page.locator(`#fighter-${seat}`)).toHaveAttribute('data-y', '600');
    await expect(page.locator(`#fighter-${seat}`)).toHaveAttribute('data-mode', 'idle');
  }
  await expect(page.locator('#match-id')).toHaveText('—');
  await expect(page.locator('#tick')).toHaveText('0');
  await expect(page.locator('#round-number')).toHaveText('1');
  await expect(page.locator('#wins')).toHaveText('0 – 0');
  await expect(page.locator('#round-result')).toHaveText('Server decides all movement, hits and results.');
  await expect(page.locator('#room-code')).toHaveText('—');
  await expect(page.locator('#invite')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Leave room', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem('shadow-clash-seat'))).toBeNull();
}

test('two independent contexts play one authoritative round, reject a third and survive disconnect', async ({ browser }, testInfo) => {
  const options = { baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 1100 } };
  const a = await browser.newContext(options), b = await browser.newContext(options), c = await browser.newContext(options);
  const p1 = await a.newPage(), p2 = await b.newPage(), third = await c.newPage();
  const errors: string[] = [];
  for (const page of [p1, p2, third]) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  }
  try {
    await p1.goto('/');
    await expect(p1.locator('canvas')).toBeVisible();
    await p1.getByRole('button', { name: 'Fight a Friend', exact: true }).click();
    const code = (await p1.locator('#room-code').textContent())!;
    await expect(p1.locator('#your-seat')).toHaveText('P1 · White Ninja');
    await p2.goto(`/?room=${code}`);
    await p2.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(p2.locator('#your-seat')).toHaveText('P2 · Black Ninja');
    await expect(p1.locator('#round-status')).toHaveText('Fight!');
    await expect(p2.locator('#round-status')).toHaveText('Fight!');
    const match = await p1.locator('#match-id').textContent();
    await expect(p2.locator('#match-id')).toHaveText(match!);
    const tick = Number(await p1.locator('#tick').textContent());
    await expect.poll(() => p2.locator('#tick').textContent().then(Number)).toBeGreaterThan(tick);

    // A miss and a long held button produce no hit or attack repetition.
    await punch(p1);
    await expect(hp(p1, 1)).toHaveText('100');
    await expect(hp(p2, 1)).toHaveText('100');
    await p1.keyboard.down('a');
    await expect.poll(() => x(p2, 0)).toBeLessThan(350);
    await p1.keyboard.up('a');
    await expect.poll(() => x(p1, 0)).toBeLessThan(350);
    expect(await x(p1, 1)).toBe(880);
    await p2.keyboard.down('a');
    await expect.poll(() => x(p1, 1)).toBeLessThan(810);
    await p2.keyboard.up('a');
    await expect.poll(() => x(p2, 1)).toBeLessThan(810);

    await p1.keyboard.down('d');
    await expect.poll(async () => (await x(p1, 1)) - (await x(p1, 0))).toBeLessThan(95);
    await p1.keyboard.up('d');
    await p2.keyboard.down('l');
    await expect(p1.locator('#fighter-1')).toHaveAttribute('data-mode', 'block');
    await punch(p1);
    await expect(hp(p1, 1)).toHaveText('100');
    await expect(hp(p2, 1)).toHaveText('100');
    await expect(p1.locator('#guard-1')).toHaveText('82');
    await expect(p2.locator('#guard-1')).toHaveText('82');
    await p2.keyboard.up('l');
    await expect(p1.locator('#fighter-1')).not.toHaveAttribute('data-mode', 'block');

    await p1.keyboard.down('j');
    await expect(hp(p1, 1)).toHaveText('95');
    await expect(hp(p2, 1)).toHaveText('95');
    await p1.waitForTimeout(850);
    await expect(hp(p1, 1)).toHaveText('95');
    await p1.keyboard.up('j');

    // Attacker's socket cannot submit authoritative health, damage, or seat.
    const invalid = await p1.evaluate(() => new Promise<Reply<null>>(resolve => {
      window.__SC_TEST__!.socket.emit('input', { seq: 999999, buttons: { left: false, right: false, jump: false, punch: false, block: false }, hp: 0, seat: 1 }, resolve);
      window.__SC_TEST__!.socket.emit('health', { seat: 1, hp: 0 });
      window.__SC_TEST__!.socket.emit('damage', { damage: 10000 });
    }));
    expect(invalid).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    await p1.waitForTimeout(150);
    await expect(hp(p2, 1)).toHaveText('95');

    await third.goto(`/?room=${code}`);
    await third.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(third.getByRole('alert')).toContainText('Room full');

    // No HP/position shortcut: nineteen more legal keyboard punches finish KO.
    for (let i = 0; i < 19; i++) await punch(p1);
    await expect(p1.locator('#round-status')).toContainText('White Ninja wins');
    await expect(p2.locator('#round-status')).toContainText('White Ninja wins');
    await expect(hp(p1, 1)).toHaveText('0');
    await expect(hp(p2, 1)).toHaveText('0');
    await p1.screenshot({ path: testInfo.outputPath('round-result.png'), fullPage: true });
    await testInfo.attach('round result', { path: testInfo.outputPath('round-result.png'), contentType: 'image/png' });

    const historyA = await p1.evaluate(() => window.__SC_TEST__!.history);
    const historyB = await p2.evaluate(() => window.__SC_TEST__!.history);
    const finalA = [...historyA].reverse().find((s: Snapshot) => s.phase === 'round_end');
    const finalB = historyB.find((s: Snapshot) => s.tick === finalA?.tick);
    expect(finalA?.result).toEqual({ round: 1, winner: 0, reason: 'ko' });
    expect(finalB).toEqual(finalA); // exact canonical tick and both fighters/outcome

    await expect(p1.locator('#round-number')).toHaveText('2');
    await expect(p2.locator('#round-number')).toHaveText('2');
    await expect(hp(p1, 0)).toHaveText('100');
    await expect(hp(p1, 1)).toHaveText('100');
    await expect(hp(p2, 1)).toHaveText('100');
    await expect(p1.locator('#round-status')).toHaveText('Fight!');
    await expect(p2.locator('#round-status')).toHaveText('Fight!');
    expect(await x(p1, 0)).toBe(400);
    expect(await x(p2, 1)).toBe(880);
    await p1.screenshot({ path: testInfo.outputPath('arena.png'), fullPage: true });
    await testInfo.attach('arena', { path: testInfo.outputPath('arena.png'), contentType: 'image/png' });

    await b.close();
    await expect(p1.locator('#round-status')).toContainText('Opponent disconnected');
    await expectLobby(p1);
    const response = await p1.request.get('http://127.0.0.1:3002/health');
    expect(response.ok()).toBe(true);
    expect(errors).toEqual([]);
  } catch (failure) {
    for (const page of [p1, p2]) {
      if (!page.isClosed()) console.log(await page.evaluate(() => ({ status: document.querySelector('#round-status')?.textContent, error: document.querySelector('#error')?.textContent, latest: window.__SC_TEST__?.history.slice(-1) })));
    }
    throw failure;
  } finally { await Promise.allSettled([a.close(), b.close(), c.close()]); }
});

test('Black can block and attack; focus loss releases controls; leaving permits a new room', async ({ browser }, testInfo) => {
  const options = { baseURL: testInfo.project.use.baseURL };
  const a = await browser.newContext(options), b = await browser.newContext(options);
  const p1 = await a.newPage(), p2 = await b.newPage();
  try {
    await p1.goto('/');
    await p1.getByRole('button', { name: 'Fight a Friend', exact: true }).click();
    await expect(p1.locator('#your-seat')).toHaveText('P1 · White Ninja');
    const code = (await p1.locator('#room-code').textContent())!;
    await p2.goto(`/?room=${code}`);
    // The arena's border/overflow clips a device-pixel row differently after
    // focus scrolling. Compare the actual canvas content without that clipping.
    const canvasCapture = { style: '#arena { overflow: visible !important; }' };
    const lobbyCanvas = await p2.locator('canvas').screenshot(canvasCapture);
    await testInfo.attach('initial lobby canvas', { body: lobbyCanvas, contentType: 'image/png' });
    await p2.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(p2.locator('#round-status')).toHaveText('Fight!');
    await p2.keyboard.down('a');
    await expect.poll(async () => (await x(p2, 1)) - (await x(p2, 0))).toBeLessThan(95);
    await p2.keyboard.up('a');
    await p1.keyboard.down('l');
    await expect(p2.locator('#fighter-0')).toHaveAttribute('data-mode', 'block');
    await punch(p2);
    await expect(hp(p1, 0)).toHaveText('100');
    await expect(p1.locator('#guard-0')).toHaveText('82');
    await expect(p2.locator('#guard-0')).toHaveText('82');
    await p1.keyboard.up('l');
    await expect(p2.locator('#fighter-0')).not.toHaveAttribute('data-mode', 'block');
    await punch(p2);
    await expect(hp(p1, 0)).toHaveText('95');
    await expect(hp(p2, 0)).toHaveText('95');

    await p1.keyboard.down('a');
    await expect.poll(() => x(p2, 0)).toBeLessThan(350);
    // Exercise the actual blur handler deterministically; no simulated game state.
    await p1.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(p2.locator('#fighter-0')).toHaveAttribute('data-mode', 'idle');
    const stopped = await x(p2, 0);
    await p1.waitForTimeout(250);
    expect(await x(p1, 0)).toBe(stopped);
    expect(await x(p2, 0)).toBe(stopped);
    await p1.keyboard.up('a');

    await p2.getByRole('button', { name: 'Leave room', exact: true }).click();
    await expectLobby(p2);
    await testInfo.attach('returned lobby canvas', { body: await p2.locator('canvas').screenshot(canvasCapture), contentType: 'image/png' });
    await expect.poll(async () => (await p2.locator('canvas').screenshot(canvasCapture)).equals(lobbyCanvas)).toBe(true);
    await expect(p1.locator('#round-status')).toContainText('Opponent disconnected');
    await expectLobby(p1);
    await p2.getByRole('button', { name: 'Fight a Friend', exact: true }).click();
    await expect(p2.locator('#your-seat')).toHaveText('P1 · White Ninja');
    await expect(p2.locator('#room-code')).not.toHaveText(code);
  } finally { await Promise.allSettled([a.close(), b.close()]); }
});

test('refresh and transport loss close old rooms, reset both clients and expose distinct connection states', async ({ browser }, testInfo) => {
  const options = { baseURL: testInfo.project.use.baseURL };
  const a = await browser.newContext(options), b = await browser.newContext(options);
  const p1 = await a.newPage(), p2 = await b.newPage();
  try {
    await p1.goto('/');
    await expect(p1.locator('#connection')).toHaveText('Connected to server');
    await p1.getByRole('button', { name: 'Fight a Friend', exact: true }).click();
    await expect(p1.locator('#connection')).toHaveText('Waiting for opponent');
    const oldCode = (await p1.locator('#room-code').textContent())!;
    await p2.goto(`/?room=${oldCode}`);
    await p2.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(p1.locator('#connection')).toHaveText('Opponent connected');
    await expect(p2.locator('#connection')).toHaveText('Opponent connected');
    await expect(p1.locator('#connection')).toHaveText('Match in progress');
    await p2.keyboard.down('a');
    await expect.poll(() => x(p1, 1)).toBeLessThan(820);
    await p2.keyboard.up('a');
    await p2.reload();
    await expect(p1.locator('#connection')).toHaveText('Opponent disconnected');
    await expect(p2.locator('#connection')).toHaveText('Connected to server');
    await expectLobby(p1);
    await expectLobby(p2);
    await expect.poll(async () => (await p1.request.get('http://127.0.0.1:3002/health').then(r => r.json())).rooms).toBe(0);
    await p2.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(p2.getByRole('alert')).toContainText('Room not found or closed');
    await p2.getByRole('button', { name: 'Fight a Friend', exact: true }).click();
    await expect(p2.locator('#connection')).toHaveText('Waiting for opponent');
    const nextCode = (await p2.locator('#room-code').textContent())!;
    expect(nextCode).not.toBe(oldCode);
    await expect(p2.locator('#round-result')).toHaveText('Server decides all movement, hits and results.');
    await expect(hp(p2, 0)).toHaveText('100');
    await expect(hp(p2, 1)).toHaveText('100');
    await p1.getByLabel('Room code', { exact: true }).fill(nextCode);
    await p1.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(p1.locator('#connection')).toHaveText('Match in progress');
    await p1.evaluate(() => window.__SC_TEST__!.socket.disconnect());
    await expect(p1.locator('#connection')).toHaveText('Connection lost');
    await expect(p2.locator('#connection')).toHaveText('Opponent disconnected');
    await expectLobby(p1);
    await expectLobby(p2);
    await p1.evaluate(() => window.__SC_TEST__!.socket.connect());
    await expect(p1.locator('#connection')).toHaveText('Connected to server');
    await expect(p1.getByRole('alert')).toBeHidden();
    await expect.poll(async () => (await p1.request.get('http://127.0.0.1:3002/health').then(r => r.json())).rooms).toBe(0);
  } finally { await Promise.allSettled([a.close(), b.close()]); }
});

test('copying an invite without the secure clipboard API selects a manual-copy fallback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Fight a Friend', exact: true }).click();
  await expect(page.locator('#invite')).toBeVisible();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.locator('#copy-status')).toHaveText('Select and copy the link');
  const selected = await page.locator('#invite-link').evaluate((node: HTMLInputElement) => node.selectionStart === 0 && node.selectionEnd === node.value.length);
  expect(selected).toBe(true);
  expect(errors).toEqual([]);
});

test('late real create and leave replies cannot restore or clear a newer room', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Connected to server');
  for (const event of ['room:create', 'room:leave'] as const) {
    await holdRealReplyAcrossReconnect(page, event);
    await page.getByRole('button', { name: event === 'room:create' ? 'Fight a Friend' : 'Leave room', exact: true }).click();
    await expect.poll(() => page.evaluate(() => typeof (window.__SC_TEST__ as AckHarness).releaseAck)).toBe('function');
    await expect(page.locator('#connection')).toHaveText('Connected to server');
    await page.getByRole('button', { name: 'Fight a Friend', exact: true }).click();
    await expect(page.locator('#connection')).toHaveText('Waiting for opponent');
    const currentCode = (await page.locator('#room-code').textContent())!;
    const currentMatch = (await page.locator('#match-id').textContent())!;
    await page.evaluate(() => (window.__SC_TEST__ as AckHarness).releaseAck!());
    await expect(page.locator('#room-code')).toHaveText(currentCode);
    await expect(page.locator('#match-id')).toHaveText(currentMatch);
    await expect(page.locator('#connection')).toHaveText('Waiting for opponent');
    expect(await page.request.get('http://127.0.0.1:3002/health').then(r => r.json())).toMatchObject({ rooms: 1, simulationRunning: true });
  }
});
