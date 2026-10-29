import { expect, test, type Page } from '@playwright/test';
import type { IdlePreviewReadout } from '../../apps/client/src/preview/types.js';

const read = (page: Page) => page.evaluate(() => window.__SC_IDLE_PREVIEW__!.read()!);
async function openPreview(page: Page) {
  await page.goto('/asset-preview.html');
  await expect(page.locator('#asset-status')).toHaveText('Preview ready');
}

test('isolated idle preview loops the four source frames with a fixed foot anchor and physics reference', async ({ page }) => {
  const sockets: string[] = [];
  const errors: string[] = [];
  page.on('websocket', socket => { if (socket.url().includes('/socket.io')) sockets.push(socket.url()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openPreview(page);
  const initial = await read(page);
  expect(initial).toMatchObject({ frameCount: 4, frameRate: 3, repeat: -1, originX: 0.5, originY: 0.96875,
    x: 400, y: 600, flipX: false, spriteVisible: true, boxVisible: false,
    physics: { x: 400, y: 600, width: 48, height: 84 }, camera: { scrollX: 0, scrollY: 0, zoom: 1, width: 1280, height: 720 } });
  expect(initial.scale).toBeCloseTo(84 / 470, 8);
  const frames = await page.evaluate(() => new Promise<IdlePreviewReadout[]>((resolve, reject) => {
    const samples: IdlePreviewReadout[] = [];
    const deadline = performance.now() + 6000;
    function sample() {
      const state = window.__SC_IDLE_PREVIEW__!.read()!;
      if (samples[samples.length - 1]?.frame !== state.frame) samples.push(state);
      if (samples.length === 9) { resolve(samples); return; }
      if (performance.now() > deadline) { reject(new Error('Idle animation did not repeat all four frames')); return; }
      requestAnimationFrame(sample);
    }
    sample();
  }));
  expect(new Set(frames.map(f => f.frame)).size).toBe(4);
  for (let i = 0; i < frames.length; i++) {
    const sample = frames[i]!;
    expect(sample.x).toBe(400); expect(sample.y).toBe(600);
    expect(sample.footWorldY).toBeCloseTo(600, 8);
    expect(sample.physics).toEqual(initial.physics);
    if (i > 0) expect(sample.frame).toBe((frames[i - 1]!.frame + 1) % 4);
  }
  await page.getByLabel('Display').selectOption('box');
  await expect.poll(async () => (await read(page)).spriteVisible).toBe(false);
  expect((await read(page)).boxVisible).toBe(true);
  await page.getByLabel('Display').selectOption('overlay');
  await page.getByLabel('Facing').selectOption('left');
  await expect.poll(async () => (await read(page)).flipX).toBe(true);
  const flipped = await read(page);
  expect(flipped.x).toBe(400); expect(flipped.footWorldY).toBeCloseTo(600, 8);
  expect(flipped.physics).toEqual(initial.physics);
  expect(flipped.spriteVisible && flipped.boxVisible).toBe(true);
  expect(sockets).toEqual([]); expect(errors).toEqual([]);
});

test('preview letterboxes at desktop sizes without camera shifts, canvas overflow or moving the anchor', async ({ page }, testInfo) => {
  await openPreview(page);
  for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768]] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => page.locator('canvas').boundingBox().then(box => box?.width ?? 0)).toBeGreaterThan(0);
    await page.getByLabel('Display').selectOption('box');
    await page.getByLabel('Background').selectOption('dark');
    await page.screenshot({ path: testInfo.outputPath(`before-box-${width}.png`), fullPage: true });
    await page.getByLabel('Display').selectOption('sprite');
    await page.getByLabel('Facing').selectOption('right');
    await page.screenshot({ path: testInfo.outputPath(`after-sprite-${width}.png`), fullPage: true });
    for (const background of ['checker', 'light']) {
      await page.getByLabel('Background').selectOption(background);
      await page.getByLabel('Facing').selectOption('left');
      await page.screenshot({ path: testInfo.outputPath(`${background}-flipped-${width}.png`), fullPage: true });
      const state = await read(page);
      expect(state.footWorldY).toBeCloseTo(600, 8);
      expect(state.camera).toEqual({ scrollX: 0, scrollY: 0, zoom: 1, width: 1280, height: 720 });
      expect(state.physics).toEqual({ x: 400, y: 600, width: 48, height: 84 });
      const layout = await page.evaluate(() => {
        const parent = document.querySelector('#preview-stage')!.getBoundingClientRect();
        const canvas = document.querySelector('canvas')!.getBoundingClientRect();
        return { parent: { x: parent.x, y: parent.y, right: parent.right, bottom: parent.bottom },
          canvas: { x: canvas.x, y: canvas.y, right: canvas.right, bottom: canvas.bottom, width: canvas.width, height: canvas.height },
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(layout.canvas.x).toBeGreaterThanOrEqual(layout.parent.x - 1);
      expect(layout.canvas.y).toBeGreaterThanOrEqual(layout.parent.y - 1);
      expect(layout.canvas.right).toBeLessThanOrEqual(layout.parent.right + 1);
      expect(layout.canvas.bottom).toBeLessThanOrEqual(layout.parent.bottom + 1);
      expect(layout.canvas.width / layout.canvas.height).toBeCloseTo(16 / 9, 2);
      expect(layout.overflow).toBe(false);
    }
  }
});

test('imported PNG retains transparent frame edges and fixed feet; live PvP never loads the preview asset', async ({ page }) => {
  await openPreview(page);
  const source = await page.evaluate(async () => {
    const image = new Image(); image.src = '/assets/white-ninja/white_ninja_idle_sheet.png'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    const frames = [];
    for (let frame = 0; frame < 4; frame++) {
      let bottom = -1, top = 512, transparent = 0;
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const alpha = data[(y * image.width + frame * 512 + x) * 4 + 3]!;
        if (alpha === 0) transparent++;
        if (alpha >= 16) { bottom = Math.max(bottom, y); top = Math.min(top, y); }
      }
      frames.push({ top, bottom, transparent, cornerAlpha: data[(frame * 512) * 4 + 3] });
    }
    return { width: image.width, height: image.height, frames };
  });
  expect(source.width).toBe(2048); expect(source.height).toBe(512);
  expect(source.frames.map(f => f.bottom)).toEqual([495, 495, 495, 495]);
  expect(source.frames.map(f => f.top)).toEqual([28, 26, 27, 29]);
  for (const frame of source.frames) { expect(frame.cornerAlpha).toBe(0); expect(frame.transparent).toBeGreaterThan(100000); }
  const gameRequests: string[] = [];
  page.on('request', request => gameRequests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Connected to server');
  await expect(page.locator('#your-seat')).toHaveText('Choose a room to play');
  expect(await page.evaluate(() => typeof window.__SC_IDLE_PREVIEW__)).toBe('undefined');
  expect(gameRequests.some(url => url.includes('white_ninja_idle') || url.includes('/src/preview/'))).toBe(false);
});
