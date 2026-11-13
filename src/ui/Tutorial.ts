import Phaser from 'phaser';
import { CONFIG } from '../data';
import TUT from '../data/tutorial.json';
import { Button } from './Button';
import { isFlipped } from '../systems/Orientation';

/** 有畫車廂＋月台的示意頁，車廂在下時要跟著上下翻 */
const STAGE_DEMOS = ['goal', 'push', 'sling', 'jam'];

const L = CONFIG.layout;
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const PANEL_W = 640;
const PANEL_TOP = 150;
const PANEL_H = 980;
const DEMO_Y = 480; // 示意動畫的中心
const DOOR_Y = 40; // 示意圖裡的門線（相對 DEMO_Y）

type Step = (next: () => void) => void;

/**
 * 分步驟的新手教學 modal。每一步上方有一段會循環播放的示意動畫。
 * 只使用 tween（不用 time event），遊戲暫停時動畫照樣會動。
 */
export class Tutorial extends Phaser.GameObjects.Container {
  private index = 0;
  private demo: Phaser.GameObjects.Container | null = null;
  private demoAlive = { v: false };
  /** 示意區上下翻轉時為 -1；人物與文字用它反向補正，才不會倒過來 */
  private flipSign = 1;
  private title: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Graphics;
  private prevBtn: Button;
  private nextBtn: Button;
  private skipText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private onClose: () => void) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(200);

    const shade = scene.add.rectangle(0, 0, L.width, L.height, 0x0b1222, 0.78).setOrigin(0);
    shade.setInteractive(); // 擋住後面的遊戲操作
    const panel = scene.add.graphics();
    const px = (L.width - PANEL_W) / 2;
    panel.fillStyle(0x000000, 0.3);
    panel.fillRoundedRect(px, PANEL_TOP + 8, PANEL_W, PANEL_H, 32);
    panel.fillStyle(0xfdfaf3);
    panel.fillRoundedRect(px, PANEL_TOP, PANEL_W, PANEL_H, 32);
    // 示意區底色
    panel.fillStyle(0x1f2a44);
    panel.fillRoundedRect(px + 30, PANEL_TOP + 100, PANEL_W - 60, 440, 20);

    this.title = scene.add
      .text(L.width / 2, PANEL_TOP + 52, '', { fontFamily: FONT, fontSize: '40px', color: '#1f2a44', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.bodyText = scene.add
      .text(L.width / 2, PANEL_TOP + 570, '', {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#334155',
        align: 'center',
        lineSpacing: 12,
        wordWrap: { width: PANEL_W - 70, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    this.dots = scene.add.graphics();

    const by = PANEL_TOP + PANEL_H - 130;
    this.prevBtn = new Button(scene, px + 150, by, 220, 88, TUT.prev, 0x94a3b8, () => this.go(this.index - 1));
    this.nextBtn = new Button(scene, px + PANEL_W - 170, by, 260, 88, TUT.next, 0x2f80d1, () => {
      if (this.index >= TUT.steps.length - 1) this.close();
      else this.go(this.index + 1);
    });
    this.skipText = scene.add
      .text(L.width / 2, PANEL_TOP + PANEL_H - 45, TUT.skip, {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#64748b',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.close());

    this.add([shade, panel, this.title, this.bodyText, this.dots, this.prevBtn, this.nextBtn, this.skipText]);
    this.go(0);

    // 輕微彈出
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
  }

  private go(i: number) {
    const n = TUT.steps.length;
    this.index = Phaser.Math.Clamp(i, 0, n - 1);
    const step = TUT.steps[this.index];
    this.title.setText(step.title);
    this.bodyText.setText(step.body);
    this.prevBtn.setVisible(this.index > 0);
    this.nextBtn.setText(this.index === n - 1 ? TUT.start : TUT.next);
    this.skipText.setVisible(this.index < n - 1);

    const g = this.dots;
    g.clear();
    const gap = 30;
    const x0 = L.width / 2 - ((n - 1) * gap) / 2;
    const dy = PANEL_TOP + PANEL_H - 210;
    for (let k = 0; k < n; k++) {
      g.fillStyle(k === this.index ? 0x2f80d1 : 0xcbd5e1);
      g.fillCircle(x0 + k * gap, dy, k === this.index ? 9 : 7);
    }
    this.buildDemo(step.demo);
  }

  private close() {
    this.stopDemo();
    this.scene.tweens.killTweensOf(this);
    this.destroy();
    this.onClose();
  }

  // ───────────────────────── 示意動畫 ─────────────────────────

  private stopDemo() {
    this.demoAlive.v = false;
    if (this.demo) {
      this.scene.tweens.killTweensOf(this.demo.list);
      this.demo.destroy();
      this.demo = null;
    }
  }

  private buildDemo(kind: string) {
    this.stopDemo();
    const c = this.scene.add.container(L.width / 2, DEMO_Y);
    this.flipSign = isFlipped() && STAGE_DEMOS.includes(kind) ? -1 : 1;
    c.setScale(1, this.flipSign);
    this.demo = c;
    this.add(c);
    const alive = { v: true };
    this.demoAlive = alive;
    switch (kind) {
      case 'goal': return this.demoGoal(c, alive);
      case 'push': return this.demoPush(c, alive);
      case 'sling': return this.demoSling(c, alive);
      case 'jam': return this.demoJam(c, alive);
      case 'tap': return this.demoTap(c, alive);
      case 'tips': return this.demoTips(c);
    }
  }

  /** 迷你版車廂＋車門＋月台 */
  private miniStage(c: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(0xe9e4d8);
    g.fillRect(-270, -200, 540, 200 + DOOR_Y);
    g.fillStyle(0xc9cdd6);
    g.fillRect(-270, DOOR_Y, 540, 170);
    g.fillStyle(0xf5c400);
    g.fillRect(-270, DOOR_Y + 30, 540, 8);
    g.fillStyle(0x56627a);
    g.fillRect(-270, DOOR_Y - 7, 200, 14);
    g.fillRect(70, DOOR_Y - 7, 200, 14);
    g.fillStyle(0x2c3446);
    g.fillRect(-76, DOOR_Y - 10, 6, 20);
    g.fillRect(70, DOOR_Y - 10, 6, 20);
    c.add(g);
    return g;
  }

  private person(c: Phaser.GameObjects.Container, x: number, y: number, key: string, scale = 0.8) {
    const img = this.scene.add.image(x, y, `p_${key}`).setScale(scale, scale * this.flipSign);
    c.add(img);
    return img;
  }

  private finger(c: Phaser.GameObjects.Container) {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(0, 0, 22);
    g.lineStyle(4, 0x1f2a44, 0.8);
    g.strokeCircle(0, 0, 22);
    g.setAlpha(0);
    c.add(g);
    return g;
  }

  private label(c: Phaser.GameObjects.Container, x: number, y: number, text: string, color: string, size = 34) {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#1f2a44', strokeThickness: 6 })
      .setOrigin(0.5)
      .setScale(1, this.flipSign);
    c.add(t);
    return t;
  }

  /** 依序執行步驟，跑完重設後再重來；換頁或關閉時停止 */
  private loop(alive: { v: boolean }, reset: () => void, steps: Step[]) {
    const run = (i: number) => {
      if (!alive.v) return;
      if (i >= steps.length) {
        reset();
        run(0);
        return;
      }
      steps[i](() => run(i + 1));
    };
    reset();
    run(0);
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig, next?: () => void): Step {
    return (n) => {
      this.scene.tweens.add({ ...config, onComplete: () => (next ?? n)() });
    };
  }

  private wait(ms: number): Step {
    return (n) => {
      this.scene.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: n });
    };
  }

  private demoGoal(c: Phaser.GameObjects.Container, alive: { v: boolean }) {
    this.miniStage(c);
    this.person(c, -180, -120, 'office');
    this.person(c, 160, -90, 'student');
    const waiting = [this.person(c, -170, 140, 'student'), this.person(c, 170, 140, 'backpacker')];
    const mover = this.person(c, 0, 140, 'office');
    const bar = this.scene.add.graphics();
    c.add(bar);
    const timer = { v: 1 };
    const drawBar = () => {
      bar.clear();
      bar.fillStyle(0x0f172a);
      bar.fillRoundedRect(-240, -188, 480, 18, 8);
      bar.fillStyle(timer.v > 0.3 ? 0x7ee081 : 0xff5a5a);
      bar.fillRoundedRect(-240, -188, Math.max(16, 480 * timer.v), 18, 8);
    };
    this.loop(
      alive,
      () => {
        mover.setPosition(0, 140).setAlpha(1);
        waiting.forEach((w) => w.setAlpha(1));
        timer.v = 1;
        drawBar();
      },
      [
        this.wait(400),
        (n) => {
          this.scene.tweens.add({ targets: timer, v: 0.15, duration: 2200, onUpdate: drawBar });
          this.scene.tweens.add({ targets: mover, y: -60, duration: 700, ease: 'Cubic.easeOut', onComplete: n });
        },
        this.wait(1700),
      ],
    );
  }

  private demoPush(c: Phaser.GameObjects.Container, alive: { v: boolean }) {
    this.miniStage(c);
    this.person(c, -190, -110, 'office');
    this.person(c, 180, -130, 'student');
    const p = this.person(c, 150, 145, 'office');
    const f = this.finger(c);
    const flick = this.label(c, 70, -10, TUT.flick, '#ffd27a', 40).setAlpha(0);
    this.loop(
      alive,
      () => {
        p.setPosition(150, 145);
        f.setPosition(230, 190).setAlpha(0);
        flick.setAlpha(0);
      },
      [
        this.tween({ targets: f, x: 150, y: 145, alpha: 1, duration: 450 }),
        this.wait(200),
        // 拖到門口
        (n) => {
          this.scene.tweens.add({ targets: f, x: 0, y: 70, duration: 800, ease: 'Sine.easeInOut' });
          this.scene.tweens.add({ targets: p, x: 0, y: 70, duration: 800, ease: 'Sine.easeInOut', onComplete: n });
        },
        this.wait(250),
        // 用力一甩
        (n) => {
          this.scene.tweens.add({ targets: f, y: 0, duration: 140, ease: 'Quad.easeIn' });
          this.scene.tweens.add({ targets: flick, alpha: 1, duration: 100 });
          this.scene.tweens.add({ targets: p, y: -120, duration: 600, ease: 'Cubic.easeOut', onComplete: n });
        },
        this.tween({ targets: [f, flick], alpha: 0, duration: 300 }),
        this.wait(700),
      ],
    );
  }

  private demoSling(c: Phaser.GameObjects.Container, alive: { v: boolean }) {
    this.miniStage(c);
    this.person(c, -190, -110, 'office');
    this.person(c, -100, -140, 'student');
    const START_Y = 105;
    const p = this.person(c, 0, START_Y, 'office');
    const aim = this.scene.add.graphics();
    c.add(aim);
    const f = this.finger(c);

    // 右上角圖例：綠／黃／紅，目前力道那格會亮起來
    const colors = [0x7ee081, 0xffc542, 0xff5a5a];
    const legend = colors.map((col, i) => {
      const y = -165 + i * 44;
      const box = this.scene.add.graphics();
      box.fillStyle(col);
      box.fillRoundedRect(110, y - 14, 34, 28, 8);
      const txt = this.label(c, 154, y, TUT.slingLevels[i], '#ffffff', 26).setOrigin(0, 0.5).setStroke('#1f2a44', 5);
      c.add(box);
      return [box, txt] as const;
    });
    const level = (power: number) => (power > 0.75 ? 2 : power > 0.4 ? 1 : 0);

    const pull = { v: 0 };
    const draw = () => {
      aim.clear();
      const lv = level(pull.v);
      legend.forEach(([box, txt], i) => {
        const on = pull.v > 0.02 && i === lv;
        box.setAlpha(on ? 1 : 0.3);
        txt.setAlpha(on ? 1 : 0.4);
      });
      if (pull.v <= 0.02) return;
      const fy = START_Y + pull.v * 90;
      f.setPosition(0, fy);
      // 橡皮筋
      aim.lineStyle(5, 0xffffff, 0.7);
      aim.lineBetween(0, START_Y, 0, fy);
      // 發射方向箭頭
      const col = colors[lv];
      const tip = START_Y - (40 + pull.v * 150);
      aim.lineStyle(8, col, 0.95);
      aim.lineBetween(0, START_Y, 0, tip);
      aim.fillStyle(col, 0.95);
      aim.fillTriangle(0, tip - 18, -15, tip + 4, 15, tip + 4);
    };

    this.loop(
      alive,
      () => {
        p.setPosition(0, START_Y);
        pull.v = 0;
        f.setPosition(0, START_Y).setAlpha(0);
        draw();
      },
      [
        this.tween({ targets: f, alpha: 1, duration: 300 }),
        // 慢慢往後拉：綠 → 黃 → 紅
        this.tween({ targets: pull, v: 0.3, duration: 500, onUpdate: draw }),
        this.wait(400),
        this.tween({ targets: pull, v: 0.6, duration: 500, onUpdate: draw }),
        this.wait(400),
        this.tween({ targets: pull, v: 1, duration: 500, onUpdate: draw }),
        this.wait(500),
        // 放開
        (n) => {
          pull.v = 0;
          draw();
          this.scene.tweens.add({ targets: f, alpha: 0, duration: 200 });
          this.scene.tweens.add({ targets: p, y: -120, duration: 550, ease: 'Cubic.easeOut', onComplete: n });
        },
        this.wait(900),
      ],
    );
  }

  private demoJam(c: Phaser.GameObjects.Container, alive: { v: boolean }) {
    this.miniStage(c);
    this.person(c, -180, -110, 'office');
    this.person(c, 170, -120, 'student');
    const p = this.person(c, 0, DOOR_Y, 'office');
    const doors = this.scene.add.graphics();
    c.add(doors);
    const d = { w: 0 };
    const drawDoors = () => {
      doors.clear();
      doors.fillStyle(0xd7dde8);
      doors.lineStyle(2, 0x4b5568);
      if (d.w > 0.5) {
        doors.fillRect(-70, DOOR_Y - 6, d.w, 12);
        doors.strokeRect(-70, DOOR_Y - 6, d.w, 12);
        doors.fillRect(70 - d.w, DOOR_Y - 6, d.w, 12);
        doors.strokeRect(70 - d.w, DOOR_Y - 6, d.w, 12);
      }
    };
    const jam = this.label(c, 0, -60, TUT.jam, '#ff6b6b', 44).setAlpha(0);
    this.loop(
      alive,
      () => {
        d.w = 0;
        drawDoors();
        p.clearTint();
        jam.setAlpha(0).setY(-60);
      },
      [
        this.wait(500),
        this.tween({ targets: d, w: 41, duration: 350, ease: 'Quad.easeIn', onUpdate: drawDoors }),
        (n) => {
          p.setTint(0xff7a7a);
          this.scene.tweens.add({ targets: jam, alpha: 1, y: -80, duration: 250 });
          this.scene.tweens.add({ targets: p, scaleX: 0.68, duration: 120, yoyo: true, repeat: 1, onComplete: n });
        },
        this.tween({ targets: d, w: 0, duration: 300, ease: 'Quad.easeOut', onUpdate: drawDoors }),
        this.wait(1200),
      ],
    );
  }

  private demoTap(c: Phaser.GameObjects.Container, alive: { v: boolean }) {
    const rows: [string, string, number][] = [
      ['backpacker', 'backpackerFront', -90],
      ['phone', 'office', 90],
    ];
    const g = this.scene.add.graphics();
    g.fillStyle(0xe9e4d8);
    g.fillRoundedRect(-260, -190, 520, 380, 16);
    c.add(g);
    const items = rows.map(([from, , y]) => ({ img: this.person(c, -40, y, from, 0.95), f: this.finger(c), y }));
    rows.forEach(([, to, y]) => {
      this.label(c, -40 + 110, y, '→', '#1f2a44', 44).setStroke('#ffffff', 0);
      this.person(c, 180, y, to, 0.95).setAlpha(0.35);
    });
    const [a, b] = items;
    const tapStep = (it: (typeof items)[number], to: string): Step[] => [
      this.tween({ targets: it.f, alpha: 1, scale: { from: 1.4, to: 1 }, duration: 300 }),
      (n) => {
        it.img.setTexture(`p_${to}`);
        this.scene.tweens.add({ targets: it.img, scale: { from: 1.15, to: 0.95 }, duration: 250 });
        this.scene.tweens.add({ targets: it.f, alpha: 0, duration: 250, onComplete: n });
      },
    ];
    this.loop(
      alive,
      () => {
        a.img.setTexture('p_backpacker');
        b.img.setTexture('p_phone');
        [a, b].forEach((it) => it.f.setPosition(-40, it.y + 10).setAlpha(0));
      },
      [this.wait(500), ...tapStep(a, 'backpackerFront'), this.wait(400), ...tapStep(b, 'office'), this.wait(1400)],
    );
  }

  private demoTips(c: Phaser.GameObjects.Container) {
    const s = this.scene;
    // 廣播
    const btn = s.add.graphics();
    btn.fillStyle(0x2f80d1);
    btn.fillRoundedRect(-260, -60, 150, 70, 14);
    c.add(btn);
    this.label(c, -185, -25, TUT.broadcast, '#ffffff', 24).setStroke('#1f2a44', 0);
    const arrows = this.label(c, -185, -110, '↑ ↑ ↑', '#7ee081', 34);
    s.tweens.add({ targets: arrows, y: -140, alpha: { from: 1, to: 0.2 }, duration: 800, repeat: -1 });

    // 博愛座
    const seat = s.add.graphics();
    seat.fillStyle(0xf4c6a5);
    seat.fillRoundedRect(-75, -150, 150, 110, 14);
    seat.lineStyle(3, 0xd98b52);
    seat.strokeRoundedRect(-75, -150, 150, 110, 14);
    c.add(seat);
    const elder = this.person(c, 0, 90, 'elder');
    const plus = this.label(c, 0, -170, TUT.special, '#ffd27a', 32).setAlpha(0);
    s.tweens.chain({
      targets: elder,
      loop: -1,
      tweens: [
        { y: 90, duration: 400 },
        { y: -95, duration: 900, ease: 'Sine.easeInOut' },
        { targets: plus, alpha: 1, duration: 200 },
        { targets: plus, alpha: 0, duration: 200, delay: 900 },
      ],
    });

    // 太擠
    const red = this.person(c, 185, -20, 'office', 0.95).setTint(0xff7a7a);
    this.person(c, 125, -20, 'student', 0.75);
    this.person(c, 245, -20, 'student', 0.75);
    this.person(c, 185, -85, 'student', 0.75);
    this.person(c, 185, 45, 'student', 0.75);
    this.label(c, 185, 120, TUT.crowded, '#ff6b6b', 30);
    s.tweens.add({ targets: red, scaleX: 1.05, scaleY: 0.85, duration: 300, yoyo: true, repeat: -1 });
  }
}
