import Phaser from 'phaser';
import { CONFIG, ROUTE, hex, t } from '../data';
import { Y } from '../systems/Orientation';

const L = CONFIG.layout;
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

function style(size: number, color = '#ffffff', bold = true): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' };
}

export class Hud {
  private stationNo: Phaser.GameObjects.Text;
  private stationName: Phaser.GameObjects.Text;
  private joke: Phaser.GameObjects.Text;
  private next: Phaser.GameObjects.Text;
  private score: Phaser.GameObjects.Text;
  private combo: Phaser.GameObjects.Text;
  private satBar: Phaser.GameObjects.Graphics;
  private timerBar: Phaser.GameObjects.Graphics;
  private timerText: Phaser.GameObjects.Text;
  private warning: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    const g = scene.add.graphics().setDepth(40);
    g.fillStyle(0x1f2a44);
    g.fillRect(0, 0, L.width, L.carriage.top - L.carriage.wall / 2);
    g.fillStyle(hex(ROUTE.lineColor));
    g.fillRect(0, 0, L.width, 10);

    scene.add.text(24, 22, ROUTE.lineName, style(20, '#9fb3d9', false)).setDepth(41);
    this.stationNo = scene.add.text(24, 50, '', style(22, '#cfd9ee')).setDepth(41);
    this.stationName = scene.add.text(24, 76, '', style(52)).setDepth(41);
    this.joke = scene.add.text(24, 140, '', style(22, '#ffd27a', false)).setDepth(41);
    this.next = scene.add.text(L.width - 24, 140, '', style(20, '#9fb3d9', false)).setOrigin(1, 0).setDepth(41);

    this.score = scene.add.text(L.width - 24, 22, '', style(34)).setOrigin(1, 0).setDepth(41);
    this.combo = scene.add.text(L.width - 24, 64, '', style(24, '#7ee081')).setOrigin(1, 0).setDepth(41);
    scene.add.text(L.width - 24 - 200, 100, t('satisfaction'), style(18, '#cfd9ee', false)).setOrigin(1, 0).setDepth(41);
    this.satBar = scene.add.graphics().setDepth(41);

    this.timerBar = scene.add.graphics().setDepth(41);
    this.timerText = scene.add.text(L.width - 24, 186, '', style(26)).setOrigin(1, 0.5).setDepth(42);

    this.warning = scene.add
      .text(L.width / 2, Y(L.carriage.bottom - 70), t('doorClosing'), {
        ...style(44, '#ffffff'),
        backgroundColor: '#d64045',
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setVisible(false);

    this.status = scene.add
      .text(L.width / 2, Y((L.carriage.top + L.carriage.bottom) / 2), '', {
        ...style(36, '#ffffff'),
        backgroundColor: 'rgba(31,42,68,0.75)',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setVisible(false);

    this.hint = scene.add
      .text(L.width / 2, Y(L.platform.edgeLine + 46), '', {
        ...style(22, '#1f2a44'),
        align: 'center',
        backgroundColor: 'rgba(255,255,255,0.75)',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setVisible(false);
  }

  setStation(index: number) {
    const s = ROUTE.stations[index];
    const total = ROUTE.stations.length;
    this.stationNo.setText(t('stationOf', { n: index + 1, total }));
    this.stationName.setText(s.name);
    this.joke.setText(s.joke);
    const nextS = ROUTE.stations[index + 1];
    this.next.setText(nextS ? t('nextStation', { name: nextS.name }) : t('terminal'));
  }

  setScore(score: number, combo: number, satisfaction: number) {
    this.score.setText(`${score}`);
    this.combo.setText(combo > 0 ? `${t('combo')} x${combo + 1}` : '');
    const g = this.satBar;
    const x = L.width - 24 - 190;
    const w = 190;
    const ratio = satisfaction / CONFIG.satisfaction.start;
    g.clear();
    g.fillStyle(0x0f172a);
    g.fillRoundedRect(x, 102, w, 20, 8);
    g.fillStyle(ratio > 0.5 ? 0x7ee081 : ratio > 0.25 ? 0xffc542 : 0xff5a5a);
    if (ratio > 0) g.fillRoundedRect(x, 102, Math.max(16, w * ratio), 20, 8);
  }

  /** remaining / total 秒；total = 0 代表隱藏 */
  setTimer(remaining: number, total: number) {
    const g = this.timerBar;
    g.clear();
    const x = 24;
    const w = L.width - 24 - 90;
    g.fillStyle(0x0f172a);
    g.fillRoundedRect(x, 176, w, 22, 10);
    if (total <= 0) {
      this.timerText.setText('');
      this.warning.setVisible(false);
      return;
    }
    const ratio = Phaser.Math.Clamp(remaining / total, 0, 1);
    const warn = remaining <= CONFIG.door.warningSec;
    g.fillStyle(warn ? 0xff5a5a : 0x7ee081);
    if (ratio > 0) g.fillRoundedRect(x, 176, Math.max(20, w * ratio), 22, 10);
    this.timerText.setText(`${Math.max(0, remaining).toFixed(1)}s`);
    this.warning.setVisible(warn && remaining > 0 && Math.floor(remaining * 4) % 2 === 0);
  }

  setStatus(text: string | null) {
    this.status.setVisible(!!text).setText(text ?? '');
  }

  setHint(text: string | null) {
    this.hint.setVisible(!!text).setText(text ?? '');
  }

  /** 浮起來後淡出的提示字 */
  popup(x: number, y: number, text: string, color = '#ffffff', size = 30, delay = 0) {
    const txt = this.scene.add
      .text(x, y, text, { ...style(size, color), stroke: '#1f2a44', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(70)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: txt,
      alpha: { from: 1, to: 0 },
      y: y - 70,
      delay,
      duration: 1300,
      ease: 'Cubic.easeOut',
      onStart: () => txt.setAlpha(1),
      onComplete: () => txt.destroy(),
    });
  }
}
