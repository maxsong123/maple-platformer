import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config/tuning.js';
import { touch } from '../objects/TouchState.js';

/**
 * On-screen thumb controls (only launched on touch devices).
 * Multitouch: every active pointer is tested against every button each frame,
 * so you can hold RIGHT and tap JUMP/ATTACK at the same time, or slide your thumb
 * between LEFT and RIGHT without lifting it.
 */
export default class TouchScene extends Phaser.Scene {
  constructor() { super('Touch'); }

  create() {
    touch.enabled = true;
    this.input.addPointer(3); // up to 4 simultaneous touches
    const y = GAME_H - 72;
    // big, forgiving hit zones (bigger than the drawn circles)
    this.btns = [
      this.makeBtn('left', 58, y, 34, 'arrowL', 52),
      this.makeBtn('right', 146, y, 34, 'arrowR', 52),
      this.makeBtn('attack', GAME_W - 150, y + 8, 32, 'sword', 48),
      this.makeBtn('jump', GAME_W - 62, y - 14, 38, 'arrowU', 56),
    ];
    this.input.on('pointerdown', (ptr) => {
      for (const b of this.btns) {
        if (this.hit(b, ptr)) {
          if (b.key === 'jump') touch.jumpTap = true;
          if (b.key === 'attack') touch.attackTap = true;
        }
      }
    });
    this.events.once('shutdown', () => this.release());
    this.game.events.on('blur', this.release, this);
    this.events.once('shutdown', () => this.game.events.off('blur', this.release, this));
  }

  release() { touch.left = touch.right = touch.jump = touch.attack = false; touch.jumpTap = touch.attackTap = false; }

  hit(b, ptr) { return Phaser.Math.Distance.Between(ptr.x, ptr.y, b.x, b.y) <= b.hitR; }

  makeBtn(key, x, y, r, icon, hitR) {
    const c = this.add.container(x, y).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x1d2b53, 0.38).fillCircle(0, 0, r);
    g.lineStyle(3, 0xffffff, 0.55).strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.8);
    const s = r * 0.42;
    if (icon === 'arrowL') g.fillTriangle(-s, 0, s * 0.6, -s, s * 0.6, s);
    if (icon === 'arrowR') g.fillTriangle(s, 0, -s * 0.6, -s, -s * 0.6, s);
    if (icon === 'arrowU') g.fillTriangle(0, -s, -s, s * 0.6, s, s * 0.6);
    if (icon === 'sword') {
      g.lineStyle(4, 0xffffff, 0.85).lineBetween(-s * 0.7, s * 0.7, s * 0.8, -s * 0.8);
      g.lineStyle(4, 0xffe066, 0.85).lineBetween(-s * 0.9, s * 0.1, -s * 0.1, s * 0.9);
    }
    c.add(g);
    const label = { left: '', right: '', jump: 'JUMP', attack: 'ATK' }[key];
    if (label) c.add(this.add.text(0, r * 0.55, label, { fontFamily: 'PressStart', fontSize: '6px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.8));
    c.setAlpha(0.6);
    return { key, x, y, r, hitR, c, down: false };
  }

  update() {
    const ptrs = this.input.manager.pointers.filter((p) => p.isDown);
    for (const b of this.btns) {
      const down = ptrs.some((p) => this.hit(b, p));
      touch[b.key] = down;
      if (down !== b.down) {
        b.down = down;
        this.tweens.killTweensOf(b.c);
        this.tweens.add({ targets: b.c, scale: down ? 0.88 : 1, alpha: down ? 0.95 : 0.6, duration: 70 });
      }
    }
  }
}
