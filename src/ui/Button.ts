import Phaser from 'phaser';

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private bw: number,
    private bh: number,
    text: string,
    private color: number,
    onClick: () => void,
    fontSize = 26,
  ) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, { fontFamily: 'sans-serif', fontSize: `${fontSize}px`, color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(bw, bh);
    this.setInteractive({ useHandCursor: true });
    // 只有「在按鈕上按下、也在按鈕上放開」才算點擊，
    // 避免拖曳／彈弓拉到按鈕上方放開時誤觸
    let pressed = false;
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      pressed = true;
      this.setScale(0.95);
    });
    this.on('pointerup', () => {
      this.setScale(1);
      if (pressed && this.enabled) onClick();
      pressed = false;
    });
    this.on('pointerout', () => {
      pressed = false;
      this.setScale(1);
    });
    this.draw();
    scene.add.existing(this);
    this.setDepth(50);
  }

  private draw() {
    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-this.bw / 2, -this.bh / 2 + 5, this.bw, this.bh, 18);
    g.fillStyle(this.enabled ? this.color : 0x6b7280);
    g.fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, 18);
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  setColor(color: number): this {
    this.color = color;
    this.draw();
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.label.setAlpha(enabled ? 1 : 0.6);
    this.draw();
    return this;
  }
}
