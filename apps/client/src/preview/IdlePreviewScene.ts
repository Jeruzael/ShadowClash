import Phaser from 'phaser';
import { BALANCE as B } from '@shadow-clash/shared';
import type { IdlePreviewReadout, PreviewBackground, PreviewHeight, PreviewMode } from './types.js';

const TEXTURE = 'white-ninja-idle-preview';
const ANIMATION = 'white-ninja-idle-loop';
const FRAME_SIZE = 512;
const FOOT_ROW = 496;
// Maximum visible envelope at source alpha ≥16; right edge is exclusive.
// These measurements describe the supplied art, never collision geometry.
const VISIBLE = { left: 104, right: 421, top: 26 };
const VISIBLE_HEIGHT = FOOT_ROW - VISIBLE.top;

export class IdlePreviewScene extends Phaser.Scene {
  private subject?: Phaser.GameObjects.Sprite;
  private referenceBox?: Phaser.GameObjects.Rectangle;
  private backdrop?: Phaser.GameObjects.Graphics;
  private visualHeight: PreviewHeight = 180;

  constructor(private readonly report: (state: IdlePreviewReadout) => void,
    private readonly ready: () => void, private readonly failure: (message: string) => void) { super('IdleAssetPreview'); }

  preload() {
    this.load.on('loaderror', () => this.failure('Idle sheet could not be loaded. Reload to retry.'));
    this.load.spritesheet(TEXTURE, `${import.meta.env.BASE_URL}assets/white-ninja/white_ninja_idle_sheet.png`, { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE });
  }

  create() {
    if (!this.textures.exists(TEXTURE)) return;
    this.backdrop = this.add.graphics();
    this.setBackground('dark');
    this.add.rectangle(B.arenaWidth / 2, B.floorY, B.arenaWidth, 2, 0x6be0db).setDepth(1);
    this.add.text(40, 36, 'WHITE NINJA / IDLE ASSET TEST', { fontFamily: 'monospace', fontSize: '20px', color: '#6be0db', backgroundColor: '#101722' }).setPadding(8).setDepth(2);
    this.add.text(B.spawnX[0], B.floorY + 30, 'FOOT (400, 600)', { fontFamily: 'monospace', fontSize: '16px', color: '#6be0db', backgroundColor: '#101722' }).setOrigin(0.5).setPadding(5).setDepth(2);
    this.anims.create({ key: ANIMATION, frames: this.anims.generateFrameNumbers(TEXTURE, { start: 0, end: 3 }), frameRate: 3, repeat: -1 });
    this.subject = this.add.sprite(B.spawnX[0], B.floorY, TEXTURE, 0)
      .setOrigin(0.5, FOOT_ROW / FRAME_SIZE).setScale(this.visualHeight / VISIBLE_HEIGHT).setDepth(2).play(ANIMATION);
    this.referenceBox = this.add.rectangle(B.spawnX[0], B.floorY, B.fighterWidth, B.fighterHeight, 0xe6edf3)
      .setOrigin(0.5, 1).setStrokeStyle(1, 0x6be0db).setDepth(3).setVisible(false);
    this.add.rectangle(B.spawnX[0], B.floorY, 12, 1, 0xff9a86).setDepth(4);
    this.add.rectangle(B.spawnX[0], B.floorY, 1, 12, 0xff9a86).setDepth(4);
    this.publish();
    this.ready();
  }

  setDisplayMode(mode: PreviewMode) {
    this.subject?.setVisible(mode !== 'box');
    this.referenceBox?.setVisible(mode !== 'sprite').setFillStyle(0xe6edf3, mode === 'overlay' ? 0.12 : 1);
    this.publish();
  }

  setFacing(left: boolean) { this.subject?.setFlipX(left); this.publish(); }

  setVisualHeight(height: number) {
    if (height !== 84 && height !== 140 && height !== 180 && height !== 220) return;
    this.visualHeight = height;
    this.subject?.setScale(height / VISIBLE_HEIGHT);
    this.publish();
  }

  setBackground(background: PreviewBackground) {
    if (!this.backdrop) return;
    this.backdrop.clear();
    if (background === 'checker') {
      for (let y = 0; y < B.arenaHeight; y += 32) for (let x = 0; x < B.arenaWidth; x += 32) {
        this.backdrop.fillStyle((x / 32 + y / 32) % 2 === 0 ? 0x263748 : 0x172432).fillRect(x, y, 32, 32);
      }
    } else {
      this.backdrop.fillStyle(background === 'light' ? 0xe3e8ed : 0x101722).fillRect(0, 0, B.arenaWidth, B.arenaHeight);
    }
  }

  private publish() {
    const sprite = this.subject, box = this.referenceBox;
    if (!sprite || !box) return;
    const camera = this.cameras.main;
    const bounds = sprite.getBounds();
    const leftExtent = (FRAME_SIZE / 2 - VISIBLE.left) * sprite.scaleX;
    const rightExtent = (VISIBLE.right - FRAME_SIZE / 2) * sprite.scaleX;
    this.report({ frame: Number(sprite.frame.name), frameCount: sprite.texture.getFrameNames().length,
      frameRate: sprite.anims.currentAnim!.frameRate, repeat: sprite.anims.currentAnim!.repeat,
      originX: sprite.originX, originY: sprite.originY, x: sprite.x, y: sprite.y, scale: sprite.scaleY,
      scaleX: sprite.scaleX, visualHeight: this.visualHeight,
      spriteBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      overhang: { left: Math.max(0, (sprite.flipX ? rightExtent : leftExtent) - box.width / 2),
        right: Math.max(0, (sprite.flipX ? leftExtent : rightExtent) - box.width / 2),
        above: Math.max(0, this.visualHeight - box.height) },
      footWorldY: bounds.y + sprite.displayOriginY * sprite.scaleY,
      flipX: sprite.flipX, spriteVisible: sprite.visible, boxVisible: box.visible,
      physics: { x: box.x, y: box.y, width: box.width, height: box.height },
      camera: { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom, width: camera.width, height: camera.height } });
  }

  update() { this.publish(); }
}
