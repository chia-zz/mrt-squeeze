import Phaser from 'phaser';
import { CONFIG, ROUTE, hex } from '../data';
import { Y, rectTop } from '../systems/Orientation';
import type { Passenger } from './Passenger';

const L = CONFIG.layout;
const C = L.carriage;
/** 牆的物理厚度往外加厚，避免高速乘客穿牆 */
const OUTER = 80;

export interface DoorRect {
  left: number;
  right: number;
}

type G = Phaser.GameObjects.Graphics;

/** 以設計座標（車廂在上）畫矩形，自動換算成畫面座標 */
function fillRect(g: G, x: number, y: number, w: number, h: number) {
  g.fillRect(x, rectTop(y, h), w, h);
}
function strokeRect(g: G, x: number, y: number, w: number, h: number) {
  g.strokeRect(x, rectTop(y, h), w, h);
}
function fillRound(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.fillRoundedRect(x, rectTop(y, h), w, h, r);
}
function strokeRound(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.strokeRoundedRect(x, rectTop(y, h), w, h, r);
}

/**
 * 俯視的車廂：車廂內部在一側，靠月台的牆上有兩個車門。
 * 座標都以「車廂在上」思考，畫面位置一律經過 Orientation 換算。
 */
export class Carriage {
  /** 門線在畫面上的 y */
  readonly doorLineY = Y(C.bottom);
  readonly doors: DoorRect[];
  private doorBodies: MatterJS.BodyType[] = [];
  private panels: Phaser.GameObjects.Graphics;
  /** 0 = 關門, 1 = 全開 */
  openAmount = 0;

  constructor(private scene: Phaser.Scene) {
    this.doors = L.doors.map((d) => ({ left: d.x - d.width / 2, right: d.x + d.width / 2 }));
    this.drawStatic();
    this.panels = scene.add.graphics().setDepth(20);
    this.createBodies();
    this.setOpen(0);
    this.setSolid(true);
  }

  private drawStatic() {
    const g = this.scene.add.graphics().setDepth(0);
    const w = C.wall;
    // 地板
    g.fillStyle(0xe9e4d8);
    fillRect(g, C.left, C.top, C.right - C.left, C.bottom - C.top);
    // 地板紋路
    g.lineStyle(2, 0xdcd6c7);
    for (let x = C.left + 60; x < C.right; x += 60) g.lineBetween(x, Y(C.top), x, Y(C.bottom));
    // 一般座位（裝飾，不佔物理空間）
    g.fillStyle(0x9fb7d6);
    const ps = L.prioritySeat;
    fillRound(g, ps.x + ps.width + 16, C.top + w / 2 + 4, C.right - (ps.x + ps.width + 16) - w / 2 - 6, 40, 10);
    // 博愛座
    g.fillStyle(0xf4c6a5, 0.9);
    fillRound(g, ps.x, ps.y, ps.width, ps.height, 14);
    g.lineStyle(3, 0xd98b52);
    strokeRound(g, ps.x, ps.y, ps.width, ps.height, 14);
    this.scene.add
      .text(ps.x + ps.width / 2, Y(ps.y + ps.height / 2), '博愛座', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#b25e22',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.8)
      .setDepth(1);
    // 牆
    g.fillStyle(0x56627a);
    fillRect(g, C.left - w / 2, C.top - w / 2, C.right - C.left + w, w); // 遠側
    fillRect(g, C.left - w / 2, C.top - w / 2, w, C.bottom - C.top + w); // 左
    fillRect(g, C.right - w / 2, C.top - w / 2, w, C.bottom - C.top + w); // 右
    // 靠月台的牆（車門處留空）
    let x = 0;
    for (const d of this.doors) {
      fillRect(g, x, C.bottom - w / 2, d.left - x, w);
      x = d.right;
    }
    fillRect(g, x, C.bottom - w / 2, L.width - x, w);
    // 路線色帶
    g.fillStyle(hex(ROUTE.lineColor));
    x = 0;
    for (const d of this.doors) {
      fillRect(g, x, C.bottom - 4, d.left - x, 8);
      x = d.right;
    }
    fillRect(g, x, C.bottom - 4, L.width - x, 8);
    // 門框
    g.fillStyle(0x2c3446);
    for (const d of this.doors) {
      fillRect(g, d.left - 8, C.bottom - w / 2 - 4, 8, w + 8);
      fillRect(g, d.right, C.bottom - w / 2 - 4, 8, w + 8);
    }
  }

  private createBodies() {
    const m = this.scene.matter;
    const w = C.wall;
    const opts = { isStatic: true, label: 'wall', friction: 0.05 };
    const innerTop = C.top + w / 2;
    const innerLeft = C.left + w / 2;
    const innerRight = C.right - w / 2;
    const innerBottom = C.bottom - w / 2;
    const fullW = L.width + OUTER * 2;
    const rect = (cx: number, cy: number, rw: number, rh: number, o = opts) => m.add.rectangle(cx, Y(cy), rw, rh, o);
    // 遠側、左、右：內側面對齊畫面，往外加厚
    rect(L.width / 2, innerTop - OUTER / 2, fullW, OUTER);
    rect(innerLeft - OUTER / 2, (innerTop + innerBottom) / 2, OUTER, innerBottom - innerTop + OUTER);
    rect(innerRight + OUTER / 2, (innerTop + innerBottom) / 2, OUTER, innerBottom - innerTop + OUTER);
    // 靠月台的牆分段
    let x = -OUTER;
    for (const d of this.doors) {
      rect((x + d.left) / 2, C.bottom, d.left - x, w);
      x = d.right;
    }
    rect((x + L.width + OUTER) / 2, C.bottom, L.width + OUTER - x, w);
    // 車廂兩側外面擋住，避免從側邊繞進車廂
    rect(innerLeft / 2 - OUTER / 2, (C.top + C.bottom) / 2, innerLeft + OUTER, C.bottom - C.top);
    rect((innerRight + L.width + OUTER) / 2, (C.top + C.bottom) / 2, L.width + OUTER - innerRight, C.bottom - C.top);
    // 車門：關門時才有碰撞
    for (const d of this.doors) {
      this.doorBodies.push(rect((d.left + d.right) / 2, C.bottom, d.right - d.left, w, { ...opts, label: 'door' }));
    }
  }

  setSolid(solid: boolean) {
    for (const b of this.doorBodies) b.isSensor = !solid;
  }

  /** 畫兩片對開的車門 */
  setOpen(amount: number) {
    this.openAmount = amount;
    const g = this.panels;
    g.clear();
    const w = C.wall;
    for (const d of this.doors) {
      const half = (d.right - d.left) / 2;
      const visible = half * (1 - amount);
      g.fillStyle(0xd7dde8);
      g.lineStyle(2, 0x4b5568);
      if (visible > 0.5) {
        const y = C.bottom - w / 2 + 2;
        fillRect(g, d.left, y, visible, w - 4);
        strokeRect(g, d.left, y, visible, w - 4);
        fillRect(g, d.right - visible, y, visible, w - 4);
        strokeRect(g, d.right - visible, y, visible, w - 4);
      }
    }
  }

  isInside(p: Passenger): boolean {
    return Y(p.y) < C.bottom && p.x > C.left && p.x < C.right;
  }

  isInPrioritySeat(p: Passenger): boolean {
    const ps = L.prioritySeat;
    const y = Y(p.y);
    return p.x > ps.x && p.x < ps.x + ps.width && y > ps.y && y < ps.y + ps.height;
  }

  findJammed(passengers: Passenger[]): Passenger[] {
    return passengers.filter((p) => this.isInDoorway(p));
  }

  /** 身體壓在門線上（關門會夾到） */
  isInDoorway(p: Passenger): boolean {
    if (p.leaving || !p.body) return false;
    const inset = CONFIG.door.jamInset;
    const top = C.bottom - C.wall / 2 + inset;
    const bottom = C.bottom + C.wall / 2 - inset;
    const b = (p.body as MatterJS.BodyType).bounds;
    const y1 = Y(b.min.y);
    const y2 = Y(b.max.y);
    if (Math.max(y1, y2) < top || Math.min(y1, y2) > bottom) return false;
    return this.doors.some((d) => b.max.x > d.left + inset && b.min.x < d.right - inset);
  }

  nearestDoorX(x: number): number {
    let best = this.doors[0];
    for (const d of this.doors) {
      if (Math.abs((d.left + d.right) / 2 - x) < Math.abs((best.left + best.right) / 2 - x)) best = d;
    }
    return (best.left + best.right) / 2;
  }

  /** 離車門多深（設計座標：越大越靠近車門） */
  depthOf(p: Passenger): number {
    return Y(p.y);
  }

  randomInsidePoint(margin: number): { x: number; y: number } {
    return {
      x: Phaser.Math.Between(C.left + C.wall / 2 + margin, C.right - C.wall / 2 - margin),
      y: Y(Phaser.Math.Between(C.top + C.wall / 2 + margin, C.bottom - C.wall / 2 - margin)),
    };
  }
}
