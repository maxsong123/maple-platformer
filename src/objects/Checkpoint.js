import Phaser from 'phaser';

/** Maple-style flag. Touch it to raise it (sparkle + jingle); you respawn here on death. */
export default class Checkpoint extends Phaser.GameObjects.Sprite {
  constructor(scene, x, groundY, index) {
    super(scene, x, groundY, 'flag', 0);
    this.setOrigin(0.3, 1).setDepth(9);
    scene.add.existing(this);
    this.index = index;
    this.active_ = false;
    this.respawn = { x: x + 10, y: groundY - 28 };
    this.zone = new Phaser.Geom.Rectangle(x - 14, groundY - 64, 40, 64);
  }

  get isActive() { return this.active_; }

  activate() {
    if (this.active_) return false;
    this.active_ = true;
    const s = this.scene;
    this.play('flag-raise');
    this.once('animationcomplete-flag-raise', () => this.play('flag-wave'));
    s.juice.sfx('checkpoint', { volume: 0.55 });
    s.juice.sparkleBurst(this.x + 6, this.y - 40, 10);
    s.juice.sparkleBurst(this.x + 6, this.y - 20, 6);
    // soft glow ring
    const ring = s.add.circle(this.x + 4, this.y - 24, 10, 0xfff6b0, 0.5).setDepth(8);
    s.tweens.add({ targets: ring, radius: 46, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    const t = s.add.text(this.x + 4, this.y - 70, 'CHECKPOINT!', {
      fontFamily: 'Lilita', fontSize: '18px', color: '#fff36b', stroke: '#7a2e00', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(70);
    s.tweens.add({ targets: t, y: t.y - 18, scale: { from: 0.5, to: 1 }, duration: 380, ease: 'Back.Out' });
    s.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 400, onComplete: () => t.destroy() });
    return true;
  }
}
