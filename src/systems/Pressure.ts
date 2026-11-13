import Phaser from 'phaser';
import { Passenger } from '../objects/Passenger';

interface PairLike {
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
  isActive: boolean;
  isSensor: boolean;
}

function ownerOf(body: MatterJS.BodyType): Passenger | null {
  const go = (body.parent ?? body).gameObject;
  return go instanceof Passenger ? go : null;
}

/** 每幀統計每位乘客正在接觸幾位其他乘客，當作「被擠的壓力」 */
export function updatePressure(scene: Phaser.Scene, passengers: Passenger[]) {
  for (const p of passengers) p.pressure = 0;
  const engine = scene.matter.world.engine as unknown as { pairs: { list: PairLike[] } };
  for (const pair of engine.pairs.list) {
    if (!pair.isActive || pair.isSensor) continue;
    const a = ownerOf(pair.bodyA);
    const b = ownerOf(pair.bodyB);
    if (a && b && !a.leaving && !b.leaving) {
      a.pressure++;
      b.pressure++;
    }
  }
  for (const p of passengers) p.refreshTint();
}
