import Phaser from 'phaser';

/** Small grab-bag of "game feel" helpers shared by scenes/objects. */
export default class Juice {
  constructor(scene) { this.scene = scene; }

  shake([ms, intensity]) { this.scene.cameras.main.shake(ms, intensity); }

  /** Freeze physics + anims briefly so hits feel weighty. */
  hitStop(ms) {
    const s = this.scene;
    if (s._hitStopping) return;
    s._hitStopping = true;
    s.physics.world.pause();
    s.anims.pauseAll();
    setTimeout(() => { s.physics.world.resume(); s.anims.resumeAll(); s._hitStopping = false; }, ms);
  }

  /** Maple-style stacked damage numbers. style: 'orange' | 'purple' */
  damageNumber(x, y, value, style = 'orange', big = false) {
    const s = this.scene;
    const str = String(Math.round(value));
    const off = style === 'purple' ? 10 : 0;
    const spacing = 15;
    const c = s.add.container(x, y).setDepth(50);
    [...str].forEach((ch, i) => {
      const d = s.add.image((i - (str.length - 1) / 2) * spacing, 0, 'digits', Number(ch) + off);
      c.add(d);
    });
    const base = big ? 1.25 : 1;
    c.setScale(base * 1.6);
    s.tweens.add({ targets: c, scale: base, duration: 120, ease: 'Back.Out' });
    s.tweens.add({ targets: c, y: y - 34, duration: 700, ease: 'Cubic.Out' });
    s.tweens.add({ targets: c, alpha: 0, delay: 500, duration: 300, onComplete: () => c.destroy() });
  }

  floatText(x, y, text, color = '#ffffff', size = 10) {
    const s = this.scene;
    const t = s.add.text(x, y, text, { fontFamily: 'PressStart', fontSize: `${size}px`, color, stroke: '#2a1a10', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(60);
    s.tweens.add({ targets: t, y: y - 28, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
    return t;
  }

  puff(x, y, scale = 1) {
    const p = this.scene.add.sprite(x, y, 'puff').setScale(scale).setDepth(40);
    p.play('puff'); p.once('animationcomplete', () => p.destroy());
  }

  sparkleBurst(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = this.scene.add.sprite(x, y, 'sparkle').setDepth(45);
      sp.play('sparkle');
      this.scene.tweens.add({
        targets: sp, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, alpha: 0, duration: 380, ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  flash(sprite, color = 0xffffff, ms = 80) {
    sprite.setTintFill(color);
    this.scene.time.delayedCall(ms, () => sprite.active && sprite.clearTint());
  }

  sfx(key, cfg = {}) {
    const s = this.scene;
    if (s.registry.get('muted')) return;
    s.sound.play(key, { volume: 0.6, ...cfg });
  }
}
