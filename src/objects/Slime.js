import Phaser from 'phaser';
import { ENEMY, COMBAT, BOSS } from '../config/tuning.js';

/** Maple-style green slime: patrols, hops, squashes, gets knocked back. */
export default class Slime extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, layer, opts = {}) {
    super(scene, x, y, 'slime', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.mini = !!opts.mini; // spat out by King Slime
    this.cfg = this.mini ? { ...ENEMY.slime, hp: BOSS.mini.hp, xp: BOSS.mini.xp, coinDrops: BOSS.mini.coinDrops } : ENEMY.slime;
    if (this.mini) this.setScale(BOSS.mini.scale);
    this.layer = layer;
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.setDepth(15);
    this.body.setSize(22, 16).setOffset(5, 14);
    this.nextHop = scene.time.now + Phaser.Math.Between(...this.cfg.hopEveryMs);
    this.stunUntil = 0;
    this.state = 'walk';
    this.dead = false;
    this.play('slime-idle');
    this.setFlipX(this.dir > 0);
    // tiny HP bar (Maple shows these above mobs)
    this.hpBg = scene.add.rectangle(x, y - 20, 22, 4, 0x2a1a10).setDepth(16).setVisible(false);
    this.hpFg = scene.add.rectangle(x - 10, y - 20, 20, 2, 0xff4d4d).setOrigin(0, 0.5).setDepth(17).setVisible(false);
  }

  update(time) {
    if (this.dead) return;
    const b = this.body;
    this.hpBg.setPosition(this.x, this.y - 18);
    this.hpFg.setPosition(this.x - 10, this.y - 18);
    if (time < this.stunUntil) return;

    const grounded = b.blocked.down;
    if (grounded) {
      if (this.state === 'air') { // landed
        this.state = 'walk';
        this.play('slime-crouch', true);
        this.scene.tweens.add({ targets: this, scaleX: { from: 1.25, to: 1 }, scaleY: { from: 0.75, to: 1 }, duration: 200, ease: 'Back.Out' });
        this.scene.time.delayedCall(120, () => !this.dead && this.play('slime-idle', true));
      }
      // turn at walls / ledge edges
      const aheadX = this.x + this.dir * 14;
      const below = this.layer.getTileAtWorldXY(aheadX, this.body.bottom + 4);
      if (b.blocked.left || b.blocked.right || !below) this.turn();
      if (this.state === 'walk') b.setVelocityX(this.dir * this.cfg.speed);

      if (time > this.nextHop && this.state === 'walk') {
        this.state = 'crouch';
        b.setVelocityX(0);
        this.play('slime-crouch', true);
        this.scene.time.delayedCall(160, () => {
          if (this.dead || time < this.stunUntil) return;
          this.state = 'air';
          this.play('slime-air', true);
          b.setVelocity(this.dir * this.cfg.speed * 2.2, this.cfg.hopVy);
        });
        this.nextHop = time + Phaser.Math.Between(...this.cfg.hopEveryMs);
      }
    } else if (this.state === 'walk') {
      this.state = 'air';
    }
  }

  turn() { this.dir *= -1; this.setFlipX(this.dir > 0); }

  /** apply damage; returns true if this killed it */
  damage(amount, fromX, time) {
    this.hp -= amount;
    this.hpBg.setVisible(true); this.hpFg.setVisible(true);
    this.hpFg.width = 20 * Math.max(0, this.hp) / this.maxHp;
    const kdir = this.x < fromX ? -1 : 1;
    this.body.setVelocity(kdir * COMBAT.enemyKnockback.x, COMBAT.enemyKnockback.y);
    this.stunUntil = time + 380;
    this.state = 'air';
    this.play('slime-hurt', true);
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }

  destroyAll() { this.hpBg.destroy(); this.hpFg.destroy(); this.destroy(); }
}
