import Phaser from 'phaser';
import { CONFIG, PASSENGERS, type PassengerType } from '../data';

/** M1：所有乘客都是程式繪製的圓角色塊，不載入任何圖片 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    for (const [key, type] of Object.entries(PASSENGERS.types)) {
      this.makePassengerTexture(`p_${key}`, type);
    }
    this.makePlatformTile();
    this.scene.start('Game');
  }

  private makePassengerTexture(key: string, type: PassengerType) {
    const pad = 4;
    const w = type.w + pad * 2;
    const h = type.h + pad * 2;
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    const r = Math.min(type.w, type.h) * CONFIG.physics.chamferRatio;

    ctx.fillStyle = type.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(pad, pad, type.w, type.h, r);
    ctx.fill();
    ctx.stroke();

    // 背後的大背包（俯視：畫在下方，也就是靠車門那側）
    if (type.backpack) {
      ctx.fillStyle = 'rgba(90,50,10,0.55)';
      ctx.beginPath();
      ctx.roundRect(pad + type.w * 0.18, pad + type.h * 0.58, type.w * 0.64, type.h * 0.36, 10);
      ctx.fill();
    }

    // 簡單五官
    const cx = w / 2;
    const eyeY = pad + type.h * 0.3;
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    ctx.arc(cx - type.w * 0.14, eyeY, 3.2, 0, Math.PI * 2);
    ctx.arc(cx + type.w * 0.14, eyeY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 文字標籤
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    const fontSize = type.label.length >= 3 ? 15 : 18;
    ctx.font = `bold ${fontSize}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ty = pad + type.h * (type.backpack ? 0.48 : 0.62);
    ctx.strokeText(type.label, cx, ty);
    ctx.fillText(type.label, cx, ty);
    tex.refresh();
  }

  private makePlatformTile() {
    const tex = this.textures.createCanvas('platformTile', 128, 128);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.fillStyle = '#c9cdd6';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#b4b9c4';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.fillStyle = '#bfc4ce';
    ctx.fillRect(10, 10, 48, 48);
    ctx.fillRect(70, 70, 48, 48);
    tex.refresh();
  }
}
