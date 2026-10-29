import Phaser from 'phaser';
import { BALANCE as B, createGame, type Snapshot } from '@shadow-clash/shared';

interface Visual {
  body: Phaser.GameObjects.Container;
  shape: Phaser.GameObjects.Rectangle;
  eyes: Phaser.GameObjects.Rectangle;
  fist: Phaser.GameObjects.Rectangle;
  shield: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Ellipse;
}
export class FightScene extends Phaser.Scene {
  private visuals: Visual[] = [];
  private message!: Phaser.GameObjects.Text;
  private lastRound = 0;
  private lastMatchId: string | null = null;
  private readonly lobby = createGame('');
  constructor(
    private readonly state: () => Snapshot | null,
    private readonly capture: (event: KeyboardEvent, down: boolean) => void,
    private readonly release: () => void,
  ) { super('Fight'); }

  create() {
    this.add.rectangle(640, 650, 1280, 100, 0x192330);
    this.add.rectangle(640, 601, 1200, 2, 0x3b4e62);
    for (let x = 80; x < 1280; x += 80) this.add.rectangle(x, 604, 1, 12, 0x3b4e62);
    this.add.text(48, 660, 'SHADOW CLASH / TRAINING ARENA', { fontFamily: 'monospace', fontSize: '16px', color: '#8393a7' });
    this.add.text(1232, 660, 'SERVER AUTHORITY · 60 Hz', { fontFamily: 'monospace', fontSize: '16px', color: '#8393a7' }).setOrigin(1, 0);
    for (const seat of [0, 1] as const) {
      const accent = seat === 0 ? 0x6be0db : 0xff9a86;
      const shadow = this.add.ellipse(B.spawnX[seat], B.floorY + 5, 72, 15, 0x000000, 0.4);
      const shape = this.add.rectangle(0, -42, 48, 84, seat === 0 ? 0xe6edf3 : 0x131c28).setStrokeStyle(3, accent);
      const band = this.add.rectangle(0, -64, 50, 14, 0x080c13);
      const eyes = this.add.rectangle(seat === 0 ? 10 : -10, -64, 15, 4, accent);
      const fist = this.add.rectangle(0, -50, 64, 20, accent).setVisible(false);
      const shield = this.add.rectangle(0, -44, 12, 92, accent, 0.35).setStrokeStyle(2, accent).setVisible(false);
      const label = this.add.text(0, -122, `P${seat + 1} / ${seat === 0 ? 'WHITE' : 'BLACK'}`, { fontFamily: 'monospace', fontSize: '19px', color: seat === 0 ? '#6be0db' : '#ff9a86' }).setOrigin(0.5);
      const body = this.add.container(B.spawnX[seat], B.floorY, [shape, band, eyes, fist, shield, label]);
      this.visuals.push({ body, shape, eyes, fist, shield, shadow });
    }
    this.message = this.add.text(640, 200, 'CREATE OR JOIN A PRIVATE FIGHT', { fontFamily: 'monospace', fontSize: '28px', color: '#dce7f4', align: 'center' }).setOrigin(0.5);
    const down = (event: KeyboardEvent) => this.capture(event, true);
    const up = (event: KeyboardEvent) => this.capture(event, false);
    this.input.keyboard?.on('keydown', down);
    this.input.keyboard?.on('keyup', up);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', down); this.input.keyboard?.off('keyup', up); this.release();
    });
  }

  update(_time: number, delta: number) {
    const state = this.state();
    const snap = !state || state.matchId !== this.lastMatchId || state.round !== this.lastRound || state.phase === 'countdown';
    this.lastRound = state?.round ?? 0;
    this.lastMatchId = state?.matchId ?? null;
    const alpha = 1 - Math.exp(-Math.min(delta, 100) / 40);
    for (const f of (state ?? this.lobby).fighters) {
      const v = this.visuals[f.seat];
      if (!v) continue;
      v.body.x = snap ? f.x : Phaser.Math.Linear(v.body.x, f.x, alpha);
      v.body.y = snap ? f.y : Phaser.Math.Linear(v.body.y, f.y, alpha);
      v.shadow.x = v.body.x;
      v.eyes.x = f.facing * 10;
      v.shape.setAlpha(f.mode === 'hitstun' ? 0.6 : 1);
      v.fist.setVisible(f.attack !== null && f.attack.age >= B.punch.startupTicks && f.attack.age < B.punch.startupTicks + B.punch.activeTicks);
      v.fist.x = (f.attack?.direction ?? f.facing) * (B.fighterWidth / 2 + 32);
      v.shield.setVisible(f.mode === 'block'); v.shield.x = f.facing * 34;
      v.body.setAngle(f.mode === 'knockout' ? f.facing * 75 : 0);
    }
    if (!state) { this.message?.setText('CREATE OR JOIN A PRIVATE FIGHT'); return; }
    this.message.setText(state.phase === 'active' ? '' : state.phase === 'waiting' ? 'WAITING FOR OPPONENT'
      : state.phase === 'countdown' ? String(Math.ceil(state.phaseTicks / B.tickRate))
      : state.phase === 'ended' ? 'FIGHT CLOSED'
      : state.result?.winner === 'draw' ? 'DOUBLE KO · DRAW' : `${state.result?.winner === 0 ? 'WHITE' : 'BLACK'} NINJA WINS`);
  }
}
