import Phaser from 'phaser';
import { CONFIG, type PushMode } from '../data';
import { Passenger } from '../objects/Passenger';
import { Y } from './Orientation';

const P = CONFIG.push;
const L = CONFIG.layout;

interface Sample {
  x: number;
  y: number;
  t: number;
}

export interface PushInputHooks {
  /** 現在可不可以操作（開門中才可以） */
  canInteract(): boolean;
  passengers(): Passenger[];
  /** 可以拖／彈的乘客：還在月台上，或身體卡在門線上 */
  isDraggable(p: Passenger): boolean;
  /** 已在車廂內（放開時若只是輕點，就觸發點擊動作） */
  isInside(p: Passenger): boolean;
  onTap(p: Passenger): void;
  /** 彈弓自動瞄準的目標（最近車門的門口，畫面座標）；null = 不輔助 */
  aimTarget(p: Passenger): { x: number; y: number } | null;
}

/**
 * 兩種推乘客的方式：
 * - drag：拖著乘客走，放開時依手指甩動的速度推出去
 * - sling：按住乘客往後拉，放開後往反方向彈出去
 * 車廂內的乘客只能「點」，觸發各自的小動作；卡在門線上的乘客兩種都可以。
 */
export class PushInput {
  mode: PushMode;
  private held: Passenger | null = null;
  private pointerId = -1;
  private samples: Sample[] = [];
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private tapTarget: Passenger | null = null;
  /** 拖曳時能拉到的最深位置（設計座標） */
  private grabMinDesignY = 0;
  private aim: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private hooks: PushInputHooks, mode: PushMode) {
    this.mode = mode;
    this.aim = scene.add.graphics().setDepth(30);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private hitTest(x: number, y: number): Passenger | null {
    const list = this.hooks.passengers().filter((p) => !p.leaving && p.active);
    const bodies = list.map((p) => p.body as MatterJS.BodyType);
    const hits = this.scene.matter.intersectPoint(x, y, bodies);
    for (const b of hits) {
      const go = ((b as MatterJS.BodyType).parent ?? b).gameObject;
      if (go instanceof Passenger) return go;
    }
    // 手指比較粗：找最近、且在容許範圍內的乘客（彈弓模式範圍更大）
    const slop = this.mode === 'sling' ? P.slingTouchSlop : P.touchSlop;
    let best: Passenger | null = null;
    let bestD = Infinity;
    for (const p of list) {
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y) - Math.max(p.kind.w, p.kind.h) / 2;
      if (d < slop && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.held || !this.hooks.canInteract()) return;
    const p = this.hitTest(pointer.x, pointer.y);
    if (!p) return;
    this.pointerId = pointer.id;
    this.downAt = this.scene.time.now;
    this.downX = pointer.x;
    this.downY = pointer.y;
    if (this.hooks.isDraggable(p)) {
      this.held = p;
      this.grabMinDesignY = Math.min(L.carriage.bottom, Y(p.y));
      this.samples = [{ x: pointer.x, y: pointer.y, t: this.scene.time.now }];
      p.setDepth(15);
    } else {
      this.tapTarget = p;
    }
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId || !this.held) return;
    const now = this.scene.time.now;
    this.samples.push({ x: pointer.x, y: pointer.y, t: now });
    while (this.samples.length > 2 && now - this.samples[0].t > P.flickSampleMs) this.samples.shift();
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = -1;

    if (this.tapTarget) {
      const p = this.tapTarget;
      this.tapTarget = null;
      const moved = Phaser.Math.Distance.Between(this.downX, this.downY, pointer.x, pointer.y);
      const dt = this.scene.time.now - this.downAt;
      if (moved <= P.tapMaxMove && dt <= P.tapMaxMs && p.active && !p.leaving && this.hooks.canInteract()) {
        this.hooks.onTap(p);
      }
      return;
    }

    const p = this.held;
    if (!p) return;
    this.held = null;
    this.aim.clear();
    if (!p.active || p.leaving) return;
    p.setDepth(10);

    // 卡在門邊、已過門線的乘客：輕點一下就當成「點擊」
    const moved = Phaser.Math.Distance.Between(this.downX, this.downY, pointer.x, pointer.y);
    const quick = this.scene.time.now - this.downAt <= P.tapMaxMs;
    if (moved <= P.tapMaxMove && quick && this.hooks.isInside(p)) {
      this.hooks.onTap(p);
      return;
    }

    if (this.mode === 'drag') {
      this.onMove(pointer);
      const first = this.samples[0];
      const last = this.samples[this.samples.length - 1];
      const dt = Math.max(1, last.t - first.t);
      let vx = ((last.x - first.x) / dt) * 16.67 * P.flickScale * p.kind.pushFactor;
      let vy = ((last.y - first.y) / dt) * 16.67 * P.flickScale * p.kind.pushFactor;
      const len = Math.hypot(vx, vy);
      const max = P.maxLaunch * p.kind.pushFactor;
      if (len > max) {
        vx = (vx / len) * max;
        vy = (vy / len) * max;
      }
      p.setVelocity(vx, vy);
    } else {
      const { dx, dy, power } = this.slingVector(pointer, p);
      if (power > 0.08) {
        const v = power * P.slingPower * p.kind.pushFactor;
        p.setVelocity(dx * v, dy * v);
        // 飛行中暫時減少空氣阻力：飛得比較遠，但速度不變（不會穿牆）
        p.setFrictionAir(P.slingFlightFrictionAir);
        this.scene.time.delayedCall(P.slingFlightMs, () => {
          if (p.active && !p.leaving) p.setFrictionAir(p.kind.frictionAir);
        });
      }
    }
  }

  /** 彈弓：手指相對乘客的反方向，力道 0..1 */
  private slingVector(pointer: Phaser.Input.Pointer, p: Passenger) {
    const px = p.x - pointer.x;
    const py = p.y - pointer.y;
    const len = Math.hypot(px, py);
    if (len < 1) return { dx: 0, dy: 0, power: 0, len: 0, assisted: false };
    const clamped = Math.min(len, P.slingMaxPull);
    let dx = px / len;
    let dy = py / len;
    let assisted = false;
    // 瞄準輔助：方向跟「往最近車門」差不多時，直接對準車門
    const target = this.hooks.aimTarget(p);
    if (target) {
      const tx = target.x - p.x;
      const ty = target.y - p.y;
      const tl = Math.hypot(tx, ty);
      if (tl > 1) {
        const cos = (dx * tx + dy * ty) / tl;
        if (cos > Math.cos(Phaser.Math.DegToRad(P.slingAimAssistDeg))) {
          dx = tx / tl;
          dy = ty / tl;
          assisted = true;
        }
      }
    }
    return { dx, dy, power: clamped / P.slingMaxPull, len: clamped, assisted };
  }

  /** 每幀呼叫：拖曳時讓乘客跟著手指，彈弓時畫瞄準線 */
  update() {
    const p = this.held;
    if (!p) return;
    if (!p.active || p.leaving || !this.hooks.canInteract()) {
      this.cancel();
      return;
    }
    const pointer = this.scene.input.manager.pointers.find((pt) => pt.id === this.pointerId);
    if (!pointer) return;

    if (this.mode === 'drag') {
      // 只能拖到門線（一半身體進門），要進車廂得靠「甩」
      const tx = Phaser.Math.Clamp(pointer.x, 0, L.width);
      // 已經半個身體進門的人，不會被拉回門線外
      const ty = Y(Math.max(Y(pointer.y), this.grabMinDesignY));
      let vx = (tx - p.x) * P.dragFollow;
      let vy = (ty - p.y) * P.dragFollow;
      const len = Math.hypot(vx, vy);
      if (len > P.dragMaxSpeed) {
        vx = (vx / len) * P.dragMaxSpeed;
        vy = (vy / len) * P.dragMaxSpeed;
      }
      p.setVelocity(vx, vy);
    } else {
      p.setVelocity(0, 0);
      const { dx, dy, power, len, assisted } = this.slingVector(pointer, p);
      const g = this.aim;
      g.clear();
      if (len < 4) return;
      // 橡皮筋：連到手指實際的位置
      g.lineStyle(6, 0xffffff, 0.7);
      g.lineBetween(p.x, p.y, pointer.x, pointer.y);
      // 對準車門時，在乘客身上畫一圈提示
      if (assisted) {
        g.lineStyle(4, 0xffffff, 0.9);
        g.strokeCircle(p.x, p.y, Math.max(p.kind.w, p.kind.h) / 2 + 10);
      }
      // 預估飛行方向
      const reach = 60 + power * 220;
      const color = power > 0.75 ? 0xff5a5a : power > 0.4 ? 0xffc542 : 0x7ee081;
      g.lineStyle(8, color, 0.9);
      const ex = p.x + dx * reach;
      const ey = p.y + dy * reach;
      g.lineBetween(p.x, p.y, ex, ey);
      g.fillStyle(color, 0.9);
      const a = Math.atan2(dy, dx);
      g.fillTriangle(
        ex + Math.cos(a) * 18, ey + Math.sin(a) * 18,
        ex + Math.cos(a + 2.4) * 16, ey + Math.sin(a + 2.4) * 16,
        ex + Math.cos(a - 2.4) * 16, ey + Math.sin(a - 2.4) * 16,
      );
    }
  }

  cancel() {
    if (this.held?.active) this.held.setDepth(10);
    this.held = null;
    this.tapTarget = null;
    this.pointerId = -1;
    this.aim.clear();
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
  }
}
