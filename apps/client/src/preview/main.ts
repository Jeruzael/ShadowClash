import Phaser from 'phaser';
import { BALANCE as B } from '@shadow-clash/shared';
import { IdlePreviewScene } from './IdlePreviewScene.js';
import type { IdlePreviewReadout, PreviewBackground, PreviewMode } from './types.js';
import './style.css';

const status = document.getElementById('asset-status')!;
const frame = document.getElementById('frame-index')!;
const foot = document.getElementById('foot-position')!;
let latest: IdlePreviewReadout | null = null;
const scene = new IdlePreviewScene(state => {
  latest = state;
  if (frame.textContent !== String(state.frame)) frame.textContent = String(state.frame);
  foot.textContent = `Foot anchor (${state.x}, ${state.footWorldY.toFixed(2)})`;
}, () => {
  status.textContent = 'Preview ready';
  document.querySelectorAll<HTMLSelectElement>('select').forEach(control => { control.disabled = false; });
}, message => { status.textContent = message; status.classList.add('error'); });

document.getElementById('render-mode')!.addEventListener('change', event => scene.setDisplayMode((event.target as HTMLSelectElement).value as PreviewMode));
document.getElementById('facing')!.addEventListener('change', event => scene.setFacing((event.target as HTMLSelectElement).value === 'left'));
document.getElementById('background')!.addEventListener('change', event => scene.setBackground((event.target as HTMLSelectElement).value as PreviewBackground));

const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'preview-stage', width: B.arenaWidth, height: B.arenaHeight,
  backgroundColor: '#101722', banner: false, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [scene] });
if (import.meta.env.MODE === 'test') window.__SC_IDLE_PREVIEW__ = { read: () => latest };
window.addEventListener('beforeunload', () => game.destroy(true));
