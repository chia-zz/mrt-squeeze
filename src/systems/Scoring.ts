import { CONFIG } from '../data';

const S = CONFIG.scoring;
const SAT = CONFIG.satisfaction;

export interface StationResult {
  boarded: number;
  boardPoints: number;
  allBoarded: boolean;
  allBoardBonus: number;
  specials: number;
  specialPoints: number;
  overPressure: number;
  overPressurePoints: number;
  leftBehind: number;
}

/** 分數、連擊倍率、乘客滿意度 */
export class Scoring {
  score = 0;
  combo = 0;
  satisfaction = SAT.start;

  get multiplier(): number {
    return 1 + this.combo;
  }

  private add(points: number) {
    this.score = Math.max(0, this.score + points);
  }

  private hurt(amount: number) {
    this.satisfaction = Math.max(0, Math.min(SAT.start, this.satisfaction + amount));
  }

  jam(): number {
    this.add(S.jam);
    this.combo = 0;
    this.hurt(SAT.jam);
    return S.jam;
  }

  settleStation(args: { boarded: number; leftBehind: number; specials: number; overPressure: number; hadPlatform: boolean }): StationResult {
    const boardPoints = args.boarded * S.board * this.multiplier;
    this.add(boardPoints);

    const allBoarded = args.hadPlatform && args.leftBehind === 0;
    let allBoardBonus = 0;
    if (allBoarded) {
      this.combo += 1;
      allBoardBonus = S.allBoardBonus;
      this.add(allBoardBonus);
    }

    const specialPoints = args.specials * S.special;
    this.add(specialPoints);

    const overPressurePoints = args.overPressure * S.overPressure;
    this.add(overPressurePoints);
    this.hurt(args.overPressure * SAT.overPressureEach);
    this.hurt(args.leftBehind * SAT.leftBehindEach);

    return {
      boarded: args.boarded,
      boardPoints,
      allBoarded,
      allBoardBonus,
      specials: args.specials,
      specialPoints,
      overPressure: args.overPressure,
      overPressurePoints,
      leftBehind: args.leftBehind,
    };
  }

  get isDead(): boolean {
    return this.satisfaction <= 0;
  }
}
