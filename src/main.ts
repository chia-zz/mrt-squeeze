import Phaser from 'phaser';
import { CONFIG } from './data';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1f2a44',
  width: CONFIG.layout.width,
  height: CONFIG.layout.height,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      enableSleeping: false,
      positionIterations: 10,
      velocityIterations: 8,
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
});

// 開發時方便在 console 檢查狀態
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
