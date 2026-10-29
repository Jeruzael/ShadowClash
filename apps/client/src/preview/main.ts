import Phaser from 'phaser';
import { BALANCE as B } from '@shadow-clash/shared';
import { IdlePreviewScene } from './IdlePreviewScene.js';
import type { IdlePreviewReadout, PreviewBackground, PreviewMode } from './types.js';
import './style.css';

const status = document.getElementById('asset-status')!;
const frame = document.getElementById('frame-index')!;
const foot = document.getElementById('foot-position')!;
const height = document.getElementById('visual-height')!;
const overhang = document.getElementById('visual-overhang')!;
let latest: IdlePreviewReadout | null = null;
const scene = new IdlePreviewScene(state => {
  latest = state;
  if (frame.textContent !== String(state.frame)) frame.textContent = String(state.frame);
  const footText = `Foot anchor (${state.x}, ${state.footWorldY.toFixed(2)})`;
  if (foot.textContent !== footText) foot.textContent = footText;
  const heightText = `Visual height ${state.visualHeight} px · Collision reference 48 × 84`;
  if (height.textContent !== heightText) height.textContent = heightText;
  const overhangText = `Visual overhang: ${state.overhang.left.toFixed(1)} px left / ${state.overhang.right.toFixed(1)} px right / ${state.overhang.above.toFixed(1)} px above the collision box (maximum visible envelope).`;
  if (overhang.textContent !== overhangText) overhang.textContent = overhangText;
}, () => {
  status.textContent = 'Preview ready';
  document.querySelectorAll<HTMLSelectElement>('select').forEach(control => { control.disabled = false; });
}, message => { status.textContent = message; status.classList.add('error'); });

document.getElementById('render-mode')!.addEventListener('change', event => scene.setDisplayMode((event.target as HTMLSelectElement).value as PreviewMode));
document.getElementById('facing')!.addEventListener('change', event => scene.setFacing((event.target as HTMLSelectElement).value === 'left'));
document.getElementById('background')!.addEventListener('change', event => scene.setBackground((event.target as HTMLSelectElement).value as PreviewBackground));
document.getElementById('fighter-height')!.addEventListener('change', event => scene.setVisualHeight(Number((event.target as HTMLSelectElement).value)));

const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'preview-stage', width: B.arenaWidth, height: B.arenaHeight,
  backgroundColor: '#101722', banner: false, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [scene] });
if (import.meta.env.MODE === 'test') window.__SC_IDLE_PREVIEW__ = { read: () => latest };
window.addEventListener('beforeunload', () => game.destroy(true));
