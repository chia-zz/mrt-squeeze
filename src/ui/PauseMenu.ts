import Phaser from 'phaser';
import { CONFIG, t, type PushMode } from '../data';
import type { CarriagePos } from '../systems/Settings';
import { Button } from './Button';

const L = CONFIG.layout;
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const ON = 0x2f80d1;
const OFF = 0x94a3b8;

export interface PauseMenuHooks {
  carriagePos: CarriagePos;
  pushMode: PushMode;
  onResume(): void;
  onCarriagePos(pos: CarriagePos): void;
  onPushMode(mode: PushMode): void;
  onTutorial(): void;
  onRestart(): void;
}

/** 暫停選單：繼續、車廂位置、操作方式、新手教學、重新開始 */
export class PauseMenu extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, private hooks: PauseMenuHooks) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(200);

    const shade = scene.add.rectangle(0, 0, L.width, L.height, 0x0b1222, 0.78).setOrigin(0);
    shade.setInteractive();
    const W = 600;
    const H = 860;
    const top = (L.height - H) / 2;
    const px = (L.width - W) / 2;
    const cx = L.width / 2;
    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.3);
    panel.fillRoundedRect(px, top + 8, W, H, 32);
    panel.fillStyle(0xfdfaf3);
    panel.fillRoundedRect(px, top, W, H, 32);

    const text = (y: number, s: string, size: number, color = '#1f2a44', bold = true) =>
      scene.add
        .text(cx, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
        .setOrigin(0.5);

    const title = text(top + 64, t('pauseTitle'), 44);
    const resume = new Button(scene, cx, top + 170, 480, 96, t('resume'), 0x16a34a, () => hooks.onResume(), 32);

    // 車廂位置
    const posLabel = text(top + 268, t('carriagePos'), 26, '#475569');
    const posTop = new Button(scene, cx - 122, top + 330, 236, 80, t('carriageTop'), OFF, () => this.pickPos('top'));
    const posBottom = new Button(scene, cx + 122, top + 330, 236, 80, t('carriageBottom'), OFF, () => this.pickPos('bottom'));
    const posNote = text(top + 390, t('carriageNote'), 20, '#94a3b8', false);
    (hooks.carriagePos === 'top' ? posTop : posBottom).setColor(ON);

    // 操作方式（即時切換）
    const modeLabel = text(top + 460, t('controlMode'), 26, '#475569');
    const modeDrag = new Button(scene, cx - 122, top + 522, 236, 80, t('modeDragShort'), OFF, () => setMode('drag'));
    const modeSling = new Button(scene, cx + 122, top + 522, 236, 80, t('modeSlingShort'), OFF, () => setMode('sling'));
    const setMode = (m: PushMode) => {
      modeDrag.setColor(m === 'drag' ? ON : OFF);
      modeSling.setColor(m === 'sling' ? ON : OFF);
      if (m !== this.hooks.pushMode) {
        this.hooks.pushMode = m;
        hooks.onPushMode(m);
      }
    };
    setMode(hooks.pushMode);

    const tutorial = new Button(scene, cx - 122, top + 680, 236, 84, t('openTutorial'), 0xf59e0b, () => hooks.onTutorial());
    const restart = new Button(scene, cx + 122, top + 680, 236, 84, t('restart'), 0x64748b, () => hooks.onRestart());

    this.add([shade, panel, title, resume, posLabel, posTop, posBottom, posNote, modeLabel, modeDrag, modeSling, tutorial, restart]);
  }

  private pickPos(pos: CarriagePos) {
    if (pos === this.hooks.carriagePos) return;
    this.hooks.onCarriagePos(pos);
  }
}
