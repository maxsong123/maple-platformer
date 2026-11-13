import Phaser from 'phaser';
import { PHYS, COMBAT } from '../config/tuning.js';

/**
 * The hero. Reads all power numbers from `stats` (see config/stats.js),
 * so the habit tracker can drive them later.
 */
export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, stats, input) {
    super(scene, x, y, 'hero', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.stats = stats;
    this.inp = input;
    this.hp = stats.maxHp;
    this.setDepth(20);
    this.body.setSize(16, 38).setOffset(24, 16);
    this.body.setMaxVelocity(stats.speed * 1.6, PHYS.maxFall);
    this.body.setCollideWorldBounds(true); // left/right edges only (bottom is open so pits still work)
    this.facing = 1;
    this.lastGroundedAt = 0;
    this.jumpPressedAt = -9999;
    this.attacking = false;
    this.lastAttackAt = -9999;
    this.invulnUntil = 0;
    this.hitThisSwing = new Set();
    this.dead = false;
    this.frozen = false;
    this.play('hero-idle');
    this.on('animationcomplete-hero-attack', () => { this.attacking = false; });
  }

  get grounded() { return this.body.blocked.down || this.body.touching.down; }

  update(time) {
    if (this.dead || this.frozen) return;
    const { inp } = this;
    const b = this.body;
    const hurtLock = time < this.hurtLockUntil;

    // ── horizontal: accelerate toward target speed, snappy turnarounds
    const dir = (inp.right() ? 1 : 0) - (inp.left() ? 1 : 0);
    const target = dir * this.stats.speed * (this.attacking && this.grounded ? 0.35 : 1);
    if (!hurtLock) {
      const accel = this.grounded ? PHYS.accelGround : PHYS.accelAir;
      const dv = target - b.velocity.x;
      const rate = (dir === 0 && this.grounded ? PHYS.dragGround : accel) * (this.scene.game.loop.delta / 1000);
      b.setVelocityX(b.velocity.x + Phaser.Math.Clamp(dv, -rate, rate));
      if (dir !== 0 && !this.attacking) this.facing = dir;
    }
    this.setFlipX(this.facing < 0);

    // ── jump: coyote time + input buffer + variable height
    if (this.grounded) this.lastGroundedAt = time;
    if (inp.jumpPressed()) this.jumpPressedAt = time;
    const canCoyote = time - this.lastGroundedAt <= PHYS.coyoteMs;
    const buffered = time - this.jumpPressedAt <= PHYS.jumpBufferMs;
    if (buffered && canCoyote && !hurtLock) {
      b.setVelocityY(-this.stats.jump);
      this.jumpPressedAt = -9999;
      this.lastGroundedAt = -9999;
      this.scene.juice.sfx('jump', { volume: 0.35 });
      this.squash(0.8, 1.2);
      this.scene.juice.puff(this.x, this.y + 24, 0.5);
    }
    if (!inp.jumpHeld() && b.velocity.y < -120) b.setVelocityY(b.velocity.y * PHYS.jumpCutMultiplier);

    // landing squash
    if (this.grounded && !this.wasGrounded && this.lastFallSpeed > 300) {
      this.squash(1.25, 0.8);
      this.scene.juice.puff(this.x, this.y + 24, 0.45);
    }
    this.lastFallSpeed = b.velocity.y;
    this.wasGrounded = this.grounded;

    // ── attack
    if (inp.attackPressed() && !this.attacking && time - this.lastAttackAt > COMBAT.attackCooldownMs && !hurtLock) {
      this.attacking = true;
      this.lastAttackAt = time;
      this.hitThisSwing.clear();
      this.play('hero-attack', true);
      this.scene.juice.sfx('swing', { volume: 0.5, rate: Phaser.Math.FloatBetween(0.95, 1.1) });
      this.scene.time.delayedCall(55, () => {
        const sl = this.scene.add.sprite(this.x + this.facing * 22, this.y - 2, 'slash').setDepth(25).setFlipX(this.facing < 0);
        sl.play('slash'); sl.once('animationcomplete', () => sl.destroy());
      });
    }

    // ── animation state
    if (time < this.invulnUntil) this.setAlpha(Math.floor(time / 70) % 2 ? 0.35 : 1); else this.setAlpha(1);
    if (hurtLock) { this.play('hero-hurt', true); return; }
    if (this.attacking) return;
    if (!this.grounded) this.play('hero-jump', true);
    else if (Math.abs(b.velocity.x) > 20) this.play('hero-walk', true);
    else this.play('hero-idle', true);
  }

  /** world-space rectangle the sword hurts this frame, or null */
  swordHitbox() {
    if (!this.attacking) return null;
    const f = this.anims.currentFrame && this.anims.currentFrame.textureFrame;
    if (!COMBAT.attackActiveFrames.includes(Number(f))) return null;
    const w = COMBAT.attackReach, h = 34;
    const x = this.facing > 0 ? this.x + 4 : this.x - 4 - w;
    return new Phaser.Geom.Rectangle(x, this.y - 18, w, h);
  }

  squash(sx, sy) {
    this.scene.tweens.killTweensOf(this, ['scaleX', 'scaleY']);
    this.setScale(sx, sy);
    this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.Out' });
  }

  /** returns true if damage was applied */
  hurt(amount, fromX, time) {
    if (this.dead || time < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = time + COMBAT.invulnMs;
    this.hurtLockUntil = time + 260;
    this.attacking = false;
    const dir = this.x < fromX ? -1 : 1;
    this.body.setVelocity(dir * COMBAT.knockback.x, COMBAT.knockback.y);
    if (this.hp <= 0) this.dead = true;
    return true;
  }
}
