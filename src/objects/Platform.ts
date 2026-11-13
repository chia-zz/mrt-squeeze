import Phaser from 'phaser';
import { CONFIG } from '../data';
import { Y, rectTop } from '../systems/Orientation';

const L = CONFIG.layout;
const P = L.platform;

/** 月台：可捲動的地磚、黃線與邊界（座標同樣經過 Orientation 換算） */
export class Platform {
  private tiles: Phaser.GameObjects.TileSprite;
  private edge: Phaser.GameObjects.TileSprite;
  /** 每 16ms 捲動的像素，列車行駛時 > 0 */
  scrollSpeed = 0;

  constructor(scene: Phaser.Scene) {
    const h = P.bottom - P.top;
    this.tiles = scene.add
      .tileSprite(0, rectTop(P.top, h), L.width, h, 'platformTile')
      .setOrigin(0, 0)
      .setDepth(0);

    // 黃色警戒線（用小貼圖拼，才能跟著捲動）
    const tex = scene.textures.exists('edgeTile') ? null : scene.textures.createCanvas('edgeTile', 48, 16);
    if (tex) {
      const ctx = tex.getContext();
      ctx.fillStyle = '#f5c400';
      ctx.fillRect(0, 0, 48, 16);
      ctx.fillStyle = '#d9a900';
      ctx.fillRect(6, 4, 8, 8);
      ctx.fillRect(30, 4, 8, 8);
      tex.refresh();
    }
    this.edge = scene.add
      .tileSprite(0, rectTop(P.edgeLine - 8, 16), L.width, 16, 'edgeTile')
      .setOrigin(0, 0)
      .setDepth(1);

    // 月台外側的地面
    const g = scene.add.graphics().setDepth(0);
    g.fillStyle(0x2a3550);
    const gh = L.height - P.bottom;
    g.fillRect(0, rectTop(P.bottom, gh), L.width, gh);

    // 月台邊界（左右與外側）
    const m = scene.matter;
    const opts = { isStatic: true, label: 'wall' };
    const T = 80;
    m.add.rectangle(-T / 2, Y((P.top + P.bottom) / 2), T, h + T * 2, opts);
    m.add.rectangle(L.width + T / 2, Y((P.top + P.bottom) / 2), T, h + T * 2, opts);
    m.add.rectangle(L.width / 2, Y(P.bottom + T / 2), L.width + T * 2, T, opts);
  }

  update(delta: number) {
    if (this.scrollSpeed === 0) return;
    const dx = this.scrollSpeed * (delta / 16.67);
    this.tiles.tilePositionX += dx;
    this.edge.tilePositionX += dx;
  }

  /** 在排隊區產生 n 個不重疊的位置（畫面座標） */
  queueSlots(n: number): { x: number; y: number }[] {
    const q = L.queue;
    const cols = Math.min(n, 6);
    const rows = Math.ceil(n / cols);
    const cw = (q.right - q.left) / cols;
    const rh = (q.bottom - q.top) / Math.max(rows, 1);
    const slots: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      slots.push({
        x: q.left + cw * (c + 0.5) + Phaser.Math.Between(-8, 8),
        y: Y(q.top + rh * (r + 0.5) + Phaser.Math.Between(-6, 6)),
      });
    }
    return slots;
  }
}
