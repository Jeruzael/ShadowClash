export type PreviewMode = 'sprite' | 'box' | 'overlay';
export type PreviewBackground = 'dark' | 'checker' | 'light';
export type PreviewHeight = 84 | 140 | 180 | 220;
export interface IdlePreviewReadout {
  frame: number;
  frameCount: number;
  frameRate: number;
  repeat: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  scale: number;
  scaleX: number;
  visualHeight: PreviewHeight;
  spriteBounds: { x: number; y: number; width: number; height: number };
  overhang: { left: number; right: number; above: number };
  footWorldY: number;
  flipX: boolean;
  spriteVisible: boolean;
  boxVisible: boolean;
  physics: { x: number; y: number; width: number; height: number };
  camera: { scrollX: number; scrollY: number; zoom: number; width: number; height: number };
}
declare global { interface Window { __SC_IDLE_PREVIEW__?: { read(): IdlePreviewReadout | null } } }
