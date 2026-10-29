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
  expect(initial.scale).toBeCloseTo(180 / 470, 8);
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

test('visual height selector defaults to 180 and preserves proportions, foot and box at every size', async ({ page }) => {
  await openPreview(page);
  const selector = page.getByRole('combobox', { name: 'Fighter height', exact: true });
  await expect(selector).toHaveValue('180');
  expect(await selector.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['84', '140', '180', '220']);
  for (const height of [84, 140, 180, 220]) {
    await selector.selectOption(String(height));
    await expect.poll(async () => (await read(page)).visualHeight).toBe(height);
    for (const facing of ['left', 'right']) {
      await page.getByLabel('Facing').selectOption(facing);
      const state = await read(page);
      expect(state.x).toBe(400); expect(state.y).toBe(600);
      expect(state.footWorldY).toBeCloseTo(600, 8);
      expect(state.scale).toBeCloseTo(height / 470, 8);
      expect(state.scaleX).toBeCloseTo(height / 470, 8);
      expect(state.spriteBounds.width / state.spriteBounds.height).toBeCloseTo(1, 8);
      expect(state.spriteBounds.y).toBeGreaterThanOrEqual(0);
      expect(state.spriteBounds.y + state.spriteBounds.height).toBeLessThanOrEqual(720);
      expect(state.physics).toEqual({ x: 400, y: 600, width: 48, height: 84 });
      expect(state.frameRate).toBe(3); expect(state.repeat).toBe(-1);
      for (const mode of ['box', 'sprite', 'overlay']) {
        await page.getByLabel('Display').selectOption(mode);
        const visible = await read(page);
        expect(visible.spriteVisible).toBe(mode !== 'box');
        expect(visible.boxVisible).toBe(mode !== 'sprite');
        expect(visible.footWorldY).toBeCloseTo(600, 8);
      }
    }
    for (const background of ['dark', 'light', 'checker']) await page.getByLabel('Background').selectOption(background);
    // Observe a complete real cycle after changing scale; no playhead shortcuts.
    const samples = await page.evaluate(() => new Promise<IdlePreviewReadout[]>((resolve, reject) => {
      const states: IdlePreviewReadout[] = [], deadline = performance.now() + 5000;
      function sample() {
        const state = window.__SC_IDLE_PREVIEW__!.read()!;
        if (states[states.length - 1]?.frame !== state.frame) states.push(state);
        if (states.length === 5) { resolve(states); return; }
        if (performance.now() > deadline) { reject(new Error('Scaled loop stalled')); return; }
        requestAnimationFrame(sample);
      }
      sample();
    }));
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i]!.footWorldY).toBeCloseTo(600, 8);
      expect(samples[i]!.visualHeight).toBe(height);
      if (i) expect(samples[i]!.frame).toBe((samples[i - 1]!.frame + 1) % 4);
    }
  }
  await selector.selectOption('180');
  await page.getByLabel('Facing').selectOption('right');
  await expect(page.locator('#visual-overhang')).toContainText('34.2 px left');
  await expect(page.locator('#visual-overhang')).toContainText('39.2 px right');
  await expect(page.locator('#visual-overhang')).toContainText('96.0 px above');
});

test('preview letterboxes at desktop sizes without camera shifts, canvas overflow or moving the anchor', async ({ page }, testInfo) => {
  await openPreview(page);
  for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768]] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => page.evaluate(() => {
      const parent = document.querySelector('#preview-stage')!.getBoundingClientRect();
      const canvas = document.querySelector('canvas')!.getBoundingClientRect();
      const fit = Math.min(parent.width / 1280, parent.height / 720);
      return Math.abs(canvas.width - 1280 * fit) < 2 && Math.abs(canvas.height - 720 * fit) < 2;
    })).toBe(true);
    for (const visualHeight of [84, 140, 180, 220]) {
      await page.getByRole('combobox', { name: 'Fighter height', exact: true }).selectOption(String(visualHeight));
      await page.getByLabel('Display').selectOption('sprite');
      await page.getByLabel('Background').selectOption('dark');
      await page.getByLabel('Facing').selectOption('right');
      await page.screenshot({ path: testInfo.outputPath(`height-${visualHeight}-${width}.png`), fullPage: true });
      if (width === 1366) {
        await page.getByLabel('Display').selectOption('overlay');
        await page.screenshot({ path: testInfo.outputPath(`overlay-${visualHeight}-${width}.png`), fullPage: true });
        await page.getByLabel('Display').selectOption('sprite');
      }
      for (const background of ['checker', 'light']) {
        await page.getByLabel('Background').selectOption(background);
        await page.getByLabel('Facing').selectOption('left');
        await page.screenshot({ path: testInfo.outputPath(`${background}-flipped-${visualHeight}-${width}.png`), fullPage: true });
      }
      const state = await read(page);
      expect(state.visualHeight).toBe(visualHeight);
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
      let bottom = -1, top = 512, left = 512, right = -1, transparent = 0;
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const alpha = data[(y * image.width + frame * 512 + x) * 4 + 3]!;
        if (alpha === 0) transparent++;
        if (alpha >= 16) { bottom = Math.max(bottom, y); top = Math.min(top, y); left = Math.min(left, x); right = Math.max(right, x); }
      }
      frames.push({ top, bottom, left, right, transparent, cornerAlpha: data[(frame * 512) * 4 + 3] });
    }
    return { width: image.width, height: image.height, frames };
  });
  expect(source.width).toBe(2048); expect(source.height).toBe(512);
  expect(source.frames.map(f => f.bottom)).toEqual([495, 495, 495, 495]);
  expect(source.frames.map(f => f.top)).toEqual([28, 26, 27, 29]);
  expect(source.frames.map(f => [f.left, f.right])).toEqual([[104, 420], [104, 420], [104, 420], [104, 420]]);
  for (const frame of source.frames) { expect(frame.cornerAlpha).toBe(0); expect(frame.transparent).toBeGreaterThan(100000); }
  const gameRequests: string[] = [];
  page.on('request', request => gameRequests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveText('Connected to server');
  await expect(page.locator('#your-seat')).toHaveText('Choose a room to play');
  expect(await page.evaluate(() => typeof window.__SC_IDLE_PREVIEW__)).toBe('undefined');
  expect(gameRequests.some(url => url.includes('white_ninja_idle') || url.includes('/src/preview/'))).toBe(false);
});
