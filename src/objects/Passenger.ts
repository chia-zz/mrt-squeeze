import Phaser from 'phaser';
import { CONFIG, PASSENGERS, type PassengerType } from '../data';

const PRESSURE_TINT = 0xff7a7a;

function bodyOptions(type: PassengerType): Phaser.Types.Physics.Matter.MatterBodyConfig {
  const p = CONFIG.physics;
  return {
    label: 'passenger',
    chamfer: { radius: Math.min(type.w, type.h) * p.chamferRatio },
    density: type.density,
    frictionAir: type.frictionAir,
    friction: p.friction,
    frictionStatic: p.frictionStatic,
    restitution: p.restitution,
    slop: p.slop,
  };
}

export class Passenger extends Phaser.Physics.Matter.Image {
  typeKey: string;
  kind: PassengerType;
  /** 下車中或被留在月台，已不參與遊戲 */
  leaving = false;
  /** 本站從月台上來的新乘客 */
  isNew = false;
  /** 博愛座加分只算一次 */
  specialScored = false;
  /** 目前接觸到的其他乘客數（每幀由 Pressure 系統更新） */
  pressure = 0;
  /** 本站被車門夾到的次數 */
  jamCount = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, typeKey: string) {
    const type = PASSENGERS.types[typeKey];
    super(scene.matter.world, x, y, `p_${typeKey}`, undefined, {
      shape: { type: 'rectangle', width: type.w, height: type.h },
      ...bodyOptions(type),
    });
    this.typeKey = typeKey;
    this.kind = type;
    scene.add.existing(this);
    this.setFixedRotation();
    this.setDepth(10);
  }

  get overPressure(): boolean {
    return this.pressure > this.kind.pressureLimit;
  }

  /** 背包移到胸前、收起手機 */
  transformTo(typeKey: string) {
    const type = PASSENGERS.types[typeKey];
    const { x, y } = this;
    const vel = this.getVelocity();
    this.typeKey = typeKey;
    this.kind = type;
    this.setTexture(`p_${typeKey}`);
    this.setBody({ type: 'rectangle', width: type.w, height: type.h }, bodyOptions(type));
    this.setPosition(x, y);
    this.setFixedRotation();
    this.setVelocity(vel.x ?? 0, vel.y ?? 0);
  }

  refreshTint() {
    if (this.leaving) return;
    if (this.overPressure) this.setTint(PRESSURE_TINT);
    else this.clearTint();
  }

  /** 移出物理世界並播放離場動畫 */
  leave(scene: Phaser.Scene, tweenProps: Record<string, unknown>, duration: number) {
    this.leaving = true;
    this.setStatic(true);
    this.setSensor(true);
    this.clearTint();
    this.setDepth(5);
    scene.tweens.add({
      targets: this,
      ...tweenProps,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => this.destroy(),
    });
  }
}
