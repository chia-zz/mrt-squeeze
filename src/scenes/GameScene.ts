import Phaser from 'phaser';
import { CONFIG, PASSENGERS, ROUTE, pickWeighted, t, type PushMode } from '../data';
import { Passenger } from '../objects/Passenger';
import { Carriage } from '../objects/Carriage';
import { Platform } from '../objects/Platform';
import { PushInput } from '../systems/PushInput';
import { Scoring } from '../systems/Scoring';
import { updatePressure } from '../systems/Pressure';
import { Hud } from '../ui/Hud';
import { Button } from '../ui/Button';
import { Tutorial } from '../ui/Tutorial';
import { PauseMenu } from '../ui/PauseMenu';
import { Settings, type CarriagePos } from '../systems/Settings';
import { Y, inward, setFlipped } from '../systems/Orientation';

type Phase = 'arriving' | 'alighting' | 'opening' | 'boarding' | 'closing' | 'riding' | 'ended';

const L = CONFIG.layout;

export class GameScene extends Phaser.Scene {
  private carriage!: Carriage;
  private platform!: Platform;
  private hud!: Hud;
  private input2!: PushInput;
  private scoring!: Scoring;
  private passengers: Passenger[] = [];
  private phase: Phase = 'arriving';
  private stationIndex = 0;
  private timeLeft = 0;
  private timeTotal = 0;
  private broadcastsLeft = 0;
  private broadcastBtn!: Button;
  private modeBtn!: Button;
  private rideElapsed = 0;
  private tutorial: Tutorial | null = null;
  private menu: PauseMenu | null = null;
  private paused = false;
  private pausedTweens: Phaser.Tweens.Tween[] = [];

  constructor() {
    super('Game');
  }

  create() {
    this.passengers = [];
    this.phase = 'arriving';
    this.stationIndex = 0;
    this.scoring = new Scoring();
    this.tutorial = null;
    this.menu = null;
    this.paused = false;
    // 從暫停選單重新開始時，確保時鐘與物理不是暫停狀態
    this.time.paused = false;
    this.matter.world.resume();
    // 車廂在上或下：要在建立任何物件之前決定
    setFlipped(Settings.carriagePos === 'bottom');
    this.pausedTweens = [];

    this.platform = new Platform(this);
    this.carriage = new Carriage(this);
    this.hud = new Hud(this);

    this.input2 = new PushInput(
      this,
      {
        canInteract: () => this.phase === 'boarding' && !this.paused && !this.tutorial && !this.menu,
        passengers: () => this.passengers,
        isDraggable: (p) => !this.carriage.isInside(p) || this.carriage.isInDoorway(p),
        isInside: (p) => this.carriage.isInside(p),
        onTap: (p) => this.tapPassenger(p),
        // 彈弓瞄準輔助：對準最近車門、稍微進門一點的位置
        aimTarget: (p) =>
          this.carriage.isInside(p)
            ? null
            : { x: this.carriage.nearestDoorX(p.x), y: Y(L.carriage.bottom - CONFIG.push.slingAimDepth) },
      },
      Settings.pushMode,
    );

    const by = L.buttonsY;
    this.broadcastBtn = new Button(this, 180, by, 316, 84, t('broadcast'), 0x2f80d1, () => this.broadcast());
    this.modeBtn = new Button(this, 486, by, 276, 84, '', 0x475569, () => this.toggleMode());
    new Button(this, 668, by, 72, 84, t('pause'), 0xf59e0b, () => this.openPauseMenu(), 34);
    this.updateModeButton();
    this.broadcastBtn.setEnabled(false);

    this.add
      .text(L.width / 2, L.height - 16, t('credit'), { fontFamily: 'sans-serif', fontSize: '16px', color: '#6b7a99' })
      .setOrigin(0.5, 1);

    // 一開始車廂裡就有幾位乘客
    for (let i = 0; i < ROUTE.initialInCarriage; i++) {
      const pt = this.carriage.randomInsidePoint(60);
      this.addPassenger(pt.x, pt.y, pickWeighted(PASSENGERS.initialWeights));
    }

    this.refreshHud();
    // 手機切到背景（接電話、切 App）時自動暫停
    const onHidden = () => this.openPauseMenu();
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input2.destroy();
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
    });
    this.hud.setStation(0);
    if (Settings.tutorialSeen) this.arrive();
    else this.openTutorial(true);
  }

  // ───────────────────────── 新手教學與暫停 ─────────────────────────

  /** first = 第一次進遊戲，關掉後才開始第一站；否則是從暫停選單打開，關掉後回到暫停選單 */
  private openTutorial(first: boolean) {
    if (this.tutorial) return;
    this.tutorial = new Tutorial(this, () => {
      this.tutorial = null;
      Settings.tutorialSeen = true;
      if (first) this.arrive();
      else this.openPauseMenu();
    });
  }

  private openPauseMenu() {
    if (this.menu || this.tutorial || this.phase === 'ended') return;
    this.pauseGame();
    const close = () => {
      this.menu?.destroy();
      this.menu = null;
    };
    this.menu = new PauseMenu(this, {
      carriagePos: Settings.carriagePos,
      pushMode: this.input2.mode,
      onResume: () => {
        close();
        this.resumeGame();
      },
      onCarriagePos: (pos: CarriagePos) => {
        Settings.carriagePos = pos;
        this.scene.restart();
      },
      onPushMode: (mode: PushMode) => this.setMode(mode),
      onTutorial: () => {
        close();
        this.openTutorial(false);
      },
      onRestart: () => this.scene.restart(),
    });
  }

  private pauseGame() {
    if (this.paused) return;
    this.paused = true;
    this.input2.cancel();
    this.pausedTweens = this.tweens.getTweens().filter((tw) => tw.isPlaying());
    this.pausedTweens.forEach((tw) => tw.pause());
    this.time.paused = true;
    this.matter.world.pause();
  }

  private resumeGame() {
    if (!this.paused) return;
    this.paused = false;
    this.pausedTweens.forEach((tw) => tw.resume());
    this.pausedTweens = [];
    this.time.paused = false;
    this.matter.world.resume();
  }

  update(_time: number, delta: number) {
    if (this.paused) return;
    this.passengers = this.passengers.filter((p) => p.active);
    this.platform.update(delta);
    this.input2.update();
    updatePressure(this, this.passengers);

    if (this.phase === 'boarding') {
      this.timeLeft -= delta / 1000;
      this.hud.setTimer(this.timeLeft, this.timeTotal);
      if (this.timeLeft <= 0) this.tryCloseDoors();
    } else if (this.phase === 'riding') {
      this.rideElapsed += delta;
      const sway = Math.sin((this.rideElapsed / CONFIG.ride.swayPeriodMs) * Math.PI * 2);
      for (const p of this.inside()) {
        const v = p.getVelocity();
        p.setVelocity((v.x ?? 0) + sway * CONFIG.ride.swaySpeed * 0.1, v.y ?? 0);
      }
    }
  }

  // ───────────────────────── 站點流程 ─────────────────────────

  private get station() {
    return ROUTE.stations[this.stationIndex];
  }

  /** 列車進站：月台減速停下 */
  private arrive() {
    this.phase = 'arriving';
    this.hud.setStation(this.stationIndex);
    this.hud.setTimer(0, 0);
    this.hud.setStatus(t('arriving'));
    this.platform.scrollSpeed = CONFIG.ride.scrollSpeed;
    this.tweens.add({
      targets: this.platform,
      scrollSpeed: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => this.alight(),
    });
  }

  /** 先下後上：部分乘客從最近的車門下車 */
  private alight() {
    this.phase = 'alighting';
    this.hud.setStatus(null);
    this.carriage.setSolid(false);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: CONFIG.door.openAnimMs,
      onUpdate: (tw) => this.carriage.setOpen(tw.getValue() ?? 0),
    });

    const inside = this.inside();
    const n = Math.round(inside.length * this.station.alightRatio);
    // 越靠近車門的人越先下車
    const leaving = Phaser.Utils.Array.Shuffle(inside)
      .sort((a, b) => this.carriage.depthOf(b) - this.carriage.depthOf(a) + Phaser.Math.Between(-80, 80))
      .slice(0, n);
    const dur = CONFIG.arrive.alightAnimMs;
    leaving.forEach((p, i) => {
      const doorX = this.carriage.nearestDoorX(p.x);
      this.time.delayedCall(i * 90, () => {
        if (!p.active) return;
        p.leave(this, { x: doorX + Phaser.Math.Between(-30, 30), y: Y(L.platform.bottom - 40), alpha: 0 }, dur);
      });
    });
    const wait = n > 0 ? dur + n * 90 : 200;
    this.time.delayedCall(wait, () => this.spawnPlatform());
  }

  private spawnPlatform() {
    const s = this.station;
    const slots = this.platform.queueSlots(s.platform);
    for (const slot of slots) {
      const special = Math.random() < s.specialChance;
      const key = pickWeighted(special ? PASSENGERS.specialWeights : PASSENGERS.spawnWeights);
      const p = this.addPassenger(slot.x, slot.y, key);
      p.isNew = true;
      p.setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: CONFIG.arrive.spawnAnimMs });
    }
    this.time.delayedCall(CONFIG.arrive.spawnAnimMs, () => this.startBoarding());
  }

  private startBoarding() {
    this.phase = 'boarding';
    this.timeTotal = this.station.doorSeconds;
    this.timeLeft = this.timeTotal;
    this.broadcastsLeft = CONFIG.actions.broadcastPerStation;
    this.broadcastBtn.setEnabled(true);
    this.passengers.forEach((p) => (p.jamCount = 0));
    if (this.stationIndex <= 1) {
      this.hud.setHint(`${this.input2.mode === 'drag' ? t('hintDrag') : t('hintSling')}\n${t('hintTap')}`);
    }
  }

  private tryCloseDoors() {
    const jammed = this.carriage.findJammed(this.passengers);
    if (jammed.length > 0) {
      this.onJam(jammed);
      return;
    }
    this.phase = 'closing';
    this.input2.cancel();
    this.broadcastBtn.setEnabled(false);
    this.hud.setHint(null);
    this.hud.setTimer(0, 0);
    this.carriage.setSolid(true);
    this.tweens.addCounter({
      from: this.carriage.openAmount,
      to: 0,
      duration: CONFIG.door.closeAnimMs,
      onUpdate: (tw) => this.carriage.setOpen(tw.getValue() ?? 0),
      onComplete: () => this.settle(),
    });
  }

  /** 夾到了：車門彈回、延誤、扣分 */
  private onJam(jammed: Passenger[]) {
    const pts = this.scoring.jam();
    this.timeLeft = CONFIG.door.jamDelaySec;
    this.timeTotal = CONFIG.door.jamDelaySec;
    this.cameras.main.shake(200, 0.006);
    this.tweens.addCounter({
      from: 1,
      to: 0.55,
      duration: 140,
      yoyo: true,
      onUpdate: (tw) => this.carriage.setOpen(tw.getValue() ?? 1),
    });
    const D = CONFIG.door;
    for (const p of jammed) {
      p.jamCount++;
      this.tweens.add({ targets: p, alpha: 0.4, duration: 120, yoyo: true, repeat: 2 });
      const doorX = this.carriage.nearestDoorX(p.x);
      if (p.jamCount >= D.ejectAfterJams) {
        // 連續被夾：擠不進去，自己退回月台，保證列車一定能出發
        p.setPosition(doorX, Y(L.carriage.bottom + L.carriage.wall / 2 + p.kind.h / 2 + 6));
        p.setVelocity(0, -inward() * D.ejectSpeed);
        p.jamCount = 0;
        this.hud.popup(doorX, Y(L.carriage.bottom + 90), t('ejected'), '#ff9f6b', 26, 300);
      } else {
        // 車門彈回時順勢把人往門中間、往他身體比較多的那一側推
        const dir = this.carriage.isInside(p) ? inward() : -inward();
        p.setVelocity((doorX - p.x) * 0.15, dir * D.jamBounceSpeed);
      }
    }
    const first = jammed[0];
    this.hud.popup(first.x, first.y - 50, `${t('jam')} ${pts}`, '#ff6b6b', 38);
    this.hud.popup(first.x, first.y, t('jamDelay', { s: CONFIG.door.jamDelaySec }), '#ffd27a', 24, 200);
    this.refreshHud();
  }

  /** 車門關好：結算這一站 */
  private settle() {
    const inside = this.inside();
    const newOnes = this.passengers.filter((p) => p.isNew && !p.leaving);
    const boarded = newOnes.filter((p) => this.carriage.isInside(p));
    const leftBehind = this.passengers.filter((p) => !p.leaving && !this.carriage.isInside(p));
    const specials = inside.filter(
      (p) => p.kind.special === 'prioritySeat' && !p.specialScored && this.carriage.isInPrioritySeat(p),
    );
    specials.forEach((p) => (p.specialScored = true));
    const crushed = inside.filter((p) => p.overPressure);

    const r = this.scoring.settleStation({
      boarded: boarded.length,
      leftBehind: leftBehind.length,
      specials: specials.length,
      overPressure: crushed.length,
      hadPlatform: this.station.platform > 0,
    });
    newOnes.forEach((p) => (p.isNew = false));

    const cx = L.width / 2;
    let y = Y((L.carriage.top + L.carriage.bottom) / 2);
    let delay = 0;
    const line = (text: string, color: string) => {
      this.hud.popup(cx, y, text, color, 32, delay);
      y += 52;
      delay += 250;
    };
    if (r.boarded > 0) line(`${t('boarded', { n: r.boarded })} → +${r.boardPoints}`, '#ffffff');
    if (r.allBoarded) line(`${t('allBoarded', { c: this.scoring.multiplier })} +${r.allBoardBonus}`, '#7ee081');
    if (r.specials > 0) line(t('special', { p: r.specialPoints }), '#ffd27a');
    if (r.overPressure > 0) line(`${t('overPressure', { n: r.overPressure })} ${r.overPressurePoints}`, '#ff6b6b');
    if (r.leftBehind > 0) line(t('leftBehind', { n: r.leftBehind }), '#ff9f6b');
    for (const p of specials) this.hud.popup(p.x, p.y - 40, '♥', '#ff8fb1', 40);
    for (const p of crushed) this.tweens.add({ targets: p, scaleX: 1.08, scaleY: 0.9, duration: 120, yoyo: true, repeat: 1 });
    this.refreshHud();

    this.time.delayedCall(600, () => {
      if (this.scoring.isDead) return this.endGame(false);
      if (this.stationIndex >= ROUTE.stations.length - 1) return this.endGame(true);
      this.depart(leftBehind);
    });
  }

  /** 列車出發：月台往後退、車廂晃動 */
  private depart(leftBehind: Passenger[]) {
    this.phase = 'riding';
    this.rideElapsed = 0;
    this.hud.setStatus(null);
    const dur = CONFIG.ride.durationMs;
    for (const p of leftBehind) {
      p.leave(this, { x: p.x - L.width - 200 }, dur * 0.8);
    }
    this.tweens.add({ targets: this.platform, scrollSpeed: CONFIG.ride.scrollSpeed, duration: 600, ease: 'Sine.easeIn' });
    this.cameras.main.shake(dur, 0.0015);
    this.time.delayedCall(dur, () => {
      this.stationIndex++;
      this.arrive();
    });
  }

  private endGame(completed: boolean) {
    this.phase = 'ended';
    this.input2.cancel();
    this.broadcastBtn.setEnabled(false);
    this.hud.setTimer(0, 0);
    const shade = this.add.rectangle(0, 0, L.width, L.height, 0x0b1222, 0.72).setOrigin(0).setDepth(90);
    shade.setInteractive(); // 擋住下面的操作
    const title = completed ? t('routeDoneTitle') : t('gameOverTitle');
    this.add
      .text(L.width / 2, 470, title, { fontFamily: 'sans-serif', fontSize: '60px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(91);
    this.add
      .text(L.width / 2, 570, t('finalScore', { s: this.scoring.score }), {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        color: '#ffd27a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(91);
    new Button(this, L.width / 2, 720, 320, 96, t('playAgain'), 0x2f80d1, () => this.scene.restart()).setDepth(92);
  }

  // ───────────────────────── 玩家動作 ─────────────────────────

  private tapPassenger(p: Passenger) {
    const type = p.kind;
    const inDoorway = this.carriage.isInDoorway(p);
    if (type.action === 'transform' && type.transformTo) {
      p.transformTo(type.transformTo);
      this.hud.popup(p.x, p.y - 40, '✓', '#7ee081', 34);
    }
    if (type.action === 'inward' || inDoorway) {
      const v = p.getVelocity();
      // 卡在門邊時，順便往門的正中間靠，才不會一直卡在門框角
      const vx = inDoorway ? (this.carriage.nearestDoorX(p.x) - p.x) * CONFIG.actions.doorwayCenterPull : (v.x ?? 0);
      p.setVelocity(vx, (v.y ?? 0) + inward() * CONFIG.actions.inwardImpulse);
    }
  }

  private broadcast() {
    if (this.phase !== 'boarding' || this.broadcastsLeft <= 0) return;
    this.broadcastsLeft--;
    this.broadcastBtn.setEnabled(this.broadcastsLeft > 0);
    for (const p of this.inside()) {
      const v = p.getVelocity();
      // 離車門越近推越大力
      const k = 0.5 + (this.carriage.depthOf(p) - L.carriage.top) / (L.carriage.bottom - L.carriage.top);
      p.setVelocity(v.x ?? 0, (v.y ?? 0) + inward() * CONFIG.actions.broadcastImpulse * k);
    }
    this.hud.popup(L.width / 2, Y(L.carriage.top + 60), t('broadcastSaid'), '#ffffff', 32);
  }

  private toggleMode() {
    this.setMode(this.input2.mode === 'drag' ? 'sling' : 'drag');
  }

  private setMode(mode: PushMode) {
    this.input2.cancel();
    this.input2.mode = mode;
    Settings.pushMode = mode;
    this.updateModeButton();
    if (this.phase === 'boarding' && this.stationIndex <= 1) {
      this.hud.setHint(`${this.input2.mode === 'drag' ? t('hintDrag') : t('hintSling')}\n${t('hintTap')}`);
    }
  }

  private updateModeButton() {
    this.modeBtn.setText(this.input2.mode === 'drag' ? t('modeDrag') : t('modeSling'));
  }

  // ───────────────────────── 工具 ─────────────────────────

  private addPassenger(x: number, y: number, key: string): Passenger {
    const p = new Passenger(this, x, y, key);
    this.passengers.push(p);
    return p;
  }

  private inside(): Passenger[] {
    return this.passengers.filter((p) => p.active && !p.leaving && this.carriage.isInside(p));
  }

  private refreshHud() {
    this.hud.setScore(this.scoring.score, this.scoring.combo, this.scoring.satisfaction);
  }
}
