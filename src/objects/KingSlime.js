import Phaser from 'phaser';
import { BOSS } from '../config/tuning.js';

/**
 * King Slime mini-boss. Simple state machine:
 *   idle (waddle toward hero) -> telegraph (wind-up, flashing "!") -> attack -> idle ...
 * Attacks: SLAM (big hop onto the hero, shockwaves on landing), SUMMON (spits mini slimes),
 *          CHARGE (dash across the arena, gets dizzy if it hits a wall).
 * Enrages at 50% HP: red eyes, faster wind-ups, faster shockwaves, more minis.
 */
export default class KingSlime extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'kingslime', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.cfg = BOSS;
    this.home = { x, y };
    this.setScale(BOSS.scale).setDepth(14);
    // body in unscaled sprite pixels (Arcade multiplies by scale)
    this.body.setSize(28, 20).setOffset(6, 18);
    this.body.setMaxVelocity(600, 900);
    this.body.setCollideWorldBounds(true);
    this.reset();
    this.setVisible(false);
    this.body.enable = false;
  }

  reset() {
    this.hp = BOSS.hp; this.maxHp = BOSS.hp;
    this.enraged = false; this.dead = false;
    this.state = 'dormant'; this.stateUntil = 0;
    this.attackIdx = 0; this.dir = -1;
    this.lastAttack = null;
    this.clearTint(); this.setAngle(0); this.setScale(BOSS.scale);
    if (this.mark) { this.mark.destroy(); this.mark = null; }
  }

  /** Drop in from the sky and start the fight. */
  awaken(time) {
    const s = this.scene;
    this.reset();
    this.setPosition(this.home.x, this.home.y - 260);
    this.setVisible(true).setAlpha(1);
    this.body.enable = true;
    this.body.reset(this.home.x, this.home.y - 260);
    this.body.setVelocity(0, 200);
    this.state = 'intro';
    this.introLanding = true;
    this.play('king-air');
    s.juice.sfx('roar', { volume: 0.55 });
    this.stateUntil = time + 99999;
  }

  /** Hide + disable (used when the hero dies mid-fight; the fight resets). */
  sleep() {
    this.reset();
    this.setVisible(false);
    this.body.enable = false;
    this.setPosition(this.home.x, this.home.y);
  }

  face(px) { this.dir = px < this.x ? -1 : 1; this.setFlipX(this.dir > 0); }

  idleAnim() { if (this.scene.time.now < (this.hurtAnimUntil || 0)) return; this.play(this.enraged ? 'king-angry' : 'king-idle', true); }

  update(time, player) {
    if (this.dead || this.state === 'dormant') return;
    const b = this.body, s = this.scene;
    const grounded = b.blocked.down;
    if (this.mark) this.mark.setPosition(this.x, this.y - 62);

    switch (this.state) {
      case 'intro':
        if (grounded && this.introLanding) {
          this.introLanding = false;
          this.land(false);
          s.events.emit('boss', { show: true });
          s.bossIntroText();
          this.toIdle(time, 1200);
        }
        break;

      case 'idle': {
        this.face(player.x);
        if (time < (this.recoverUntil || 0)) { if (grounded) b.setVelocityX(0); break; }
        if (grounded) {
          const dist = Math.abs(player.x - this.x);
          b.setVelocityX(dist > 72 ? this.dir * BOSS.walkSpeed * (this.enraged ? 1.4 : 1) : 0);
          // little hops while walking (it's a slime!)
          if (time > (this.nextWobble || 0)) { this.nextWobble = time + 520; b.setVelocityY(-120); }
          this.idleAnim();
        }
        if (time > this.stateUntil && grounded) this.telegraph(time, player);
        break;
      }

      case 'telegraph':
        b.setVelocityX(0);
        // shake in place
        this.x += Math.sin(time / 22) * (this.nextAttack === 'charge' ? 1.6 : 0.8);
        if (time > this.stateUntil) this.startAttack(time, player);
        break;

      case 'slam':
        if (grounded && time > this.slamStart + 200) {
          this.land(true);
          // short recovery after landing = your window to punish it
          this.toIdle(time, 450);
          this.recoverUntil = time + 450;
        }
        break;

      case 'charge':
        b.setVelocityX(this.dir * (this.enraged ? BOSS.charge.speedEnraged : BOSS.charge.speed));
        if (time % 90 < 20) s.juice.puff(this.x - this.dir * 40, this.y + 26, 0.6);
        if (b.blocked.left || b.blocked.right || time > this.stateUntil) {
          b.setVelocityX(-this.dir * 120); b.setVelocityY(-180);
          const hitWall = b.blocked.left || b.blocked.right;
          if (hitWall) {
            s.juice.shake([260, 0.012]); s.juice.sfx('slam', { volume: 0.6, rate: 1.2 });
            this.dizzy(time);
          } else this.toIdle(time);
        }
        break;

      case 'dizzy':
        if (grounded) b.setVelocityX(0);
        this.setAngle(Math.sin(time / 60) * 6);
        if (time > this.stateUntil) { this.setAngle(0); this.toIdle(time, 400); }
        break;

      case 'summon':
        if (time > this.stateUntil) this.toIdle(time);
        break;
    }
  }

  toIdle(time, extra = 0) {
    this.state = 'idle';
    const r = this.enraged ? BOSS.restMsEnraged : BOSS.restMs;
    this.stateUntil = time + Phaser.Math.Between(...r) + extra;
    if (this.mark) { this.mark.destroy(); this.mark = null; }
    this.clearTint();
    this.idleAnim();
  }

  pickAttack(player) {
    // rotate through attacks with a little variety; never the same one twice in a row
    const minis = this.scene.slimes.filter((z) => z.mini && !z.dead).length;
    let opts = ['slam', 'charge', 'summon'].filter((a) => a !== this.lastAttack);
    if (minis >= BOSS.summon.maxMinis) opts = opts.filter((a) => a !== 'summon');
    if (Math.abs(player.x - this.x) < 90) opts = opts.filter((a) => a !== 'charge').concat(['slam']);
    return Phaser.Utils.Array.GetRandom(opts.length ? opts : ['slam']);
  }

  telegraph(time, player) {
    const s = this.scene;
    this.nextAttack = this.pickAttack(player);
    this.state = 'telegraph';
    this.face(player.x);
    this.stateUntil = time + (this.enraged ? BOSS.telegraphMsEnraged : BOSS.telegraphMs);
    this.play(this.enraged ? 'king-crouch-angry' : 'king-crouch', true);
    const col = { slam: 0xfff36b, charge: 0xff5a5a, summon: 0xc28bff }[this.nextAttack];
    // flashing tint + exclamation mark = readable wind-up
    this.flashTimer = s.time.addEvent({ delay: 90, repeat: 7, callback: () => { if (!this.dead) (this.isTinted ? this.clearTint() : this.setTint(col)); } });
    this.mark = s.add.text(this.x, this.y - 62, '!', { fontFamily: 'Lilita', fontSize: '30px', color: Phaser.Display.Color.IntegerToColor(col).rgba, stroke: '#2a1a10', strokeThickness: 6 }).setOrigin(0.5).setDepth(60);
    s.tweens.add({ targets: this.mark, scale: { from: 0.3, to: 1.2 }, duration: 200, ease: 'Back.Out' });
    s.juice.sfx('warn', { volume: 0.45, rate: this.enraged ? 1.25 : 1 });
    s.tweens.add({ targets: this, scaleY: BOSS.scale * 0.82, scaleX: BOSS.scale * 1.12, duration: 200, ease: 'Quad.Out' });
  }

  startAttack(time, player) {
    const s = this.scene, b = this.body;
    if (this.flashTimer) this.flashTimer.remove();
    this.clearTint();
    if (this.mark) { this.mark.destroy(); this.mark = null; }
    this.setScale(BOSS.scale);
    this.lastAttack = this.nextAttack;
    const a = this.nextAttack;
    if (a === 'slam') {
      this.state = 'slam'; this.slamStart = time;
      // ballistic hop that lands on the hero's current x
      const air = BOSS.slam.airMs / 1000, g = s.physics.world.gravity.y;
      const dx = Phaser.Math.Clamp(player.x - this.x, -420, 420);
      b.setVelocity(dx / air, -g * air / 2);
      this.play('king-air', true);
      s.juice.sfx('jump', { volume: 0.5, rate: 0.55 });
    } else if (a === 'charge') {
      this.state = 'charge';
      this.face(player.x);
      this.stateUntil = time + BOSS.charge.maxMs;
      this.play(this.enraged ? 'king-angry' : 'king-idle', true);
      s.juice.sfx('roar', { volume: 0.35, rate: 1.4 });
    } else {
      this.state = 'summon'; this.stateUntil = time + 600;
      const alive = s.slimes.filter((z) => z.mini && !z.dead).length;
      const n = Math.min(this.enraged ? BOSS.summon.countEnraged : BOSS.summon.count, BOSS.summon.maxMinis - alive);
      s.tweens.add({ targets: this, scaleY: BOSS.scale * 1.18, scaleX: BOSS.scale * 0.9, yoyo: true, duration: 140 });
      s.juice.sfx('puff', { volume: 0.7, rate: 0.7 });
      for (let i = 0; i < n; i++) {
        s.time.delayedCall(i * 140, () => { if (!this.dead) s.spawnMini(this.x, this.y - 40, (i % 2 ? 1 : -1) * Phaser.Math.Between(120, 220)); });
      }
    }
  }

  land(shock) {
    const s = this.scene;
    s.tweens.add({ targets: this, scaleX: { from: BOSS.scale * 1.35, to: BOSS.scale }, scaleY: { from: BOSS.scale * 0.7, to: BOSS.scale }, duration: 260, ease: 'Back.Out' });
    s.juice.shake([320, 0.018]);
    s.juice.sfx('slam', { volume: 0.8 });
    for (let i = -2; i <= 2; i++) s.juice.puff(this.x + i * 22, this.y + 26, 0.9);
    if (shock) {
      const sp = this.enraged ? BOSS.slam.shockSpeedEnraged : BOSS.slam.shockSpeed;
      s.spawnShockwave(this.body.bottom, this.x, -1, sp);
      s.spawnShockwave(this.body.bottom, this.x, 1, sp);
    }
  }

  dizzy(time) {
    this.state = 'dizzy';
    this.stateUntil = time + BOSS.charge.stunMs;
    this.play(this.enraged ? 'king-angry' : 'king-hurt', true);
    const st = this.scene.add.text(this.x, this.y - 60, '@ @', { fontFamily: 'PressStart', fontSize: '10px', color: '#fff36b', stroke: '#2a1a10', strokeThickness: 4 }).setOrigin(0.5).setDepth(60);
    this.scene.tweens.add({ targets: st, alpha: 0, y: st.y - 12, delay: BOSS.charge.stunMs - 300, duration: 300, onComplete: () => st.destroy() });
  }

  /** returns { killed, enragedNow } */
  damage(amount) {
    if (this.dead) return { killed: false };
    this.hp = Math.max(0, this.hp - amount);
    let enragedNow = false;
    if (!this.enraged && this.hp <= this.maxHp / 2 && this.hp > 0) { this.enraged = true; enragedNow = true; }
    // tiny nudge, bosses don't fly
    this.scene.tweens.add({ targets: this, scaleX: { from: BOSS.scale * 1.08, to: BOSS.scale }, scaleY: { from: BOSS.scale * 0.92, to: BOSS.scale }, duration: 120 });
    if (this.state === 'idle') { this.play('king-hurt', true); this.hurtAnimUntil = this.scene.time.now + 160; }
    if (this.hp <= 0) { this.dead = true; this.body.setVelocity(0, 0); return { killed: true }; }
    return { killed: false, enragedNow };
  }
}
