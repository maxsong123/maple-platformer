import Phaser from 'phaser';
import { touch } from './TouchState.js';

/** Keyboard + on-screen touch mapping: arrows/WASD move, Space/Up/W jump, X/J attack. */
export default class Controls {
  constructor(scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = scene.input.keyboard;
    this.k = kb.addKeys({
      left: K.LEFT, right: K.RIGHT, up: K.UP, a: K.A, d: K.D, w: K.W,
      space: K.SPACE, x: K.X, j: K.J, z: K.Z, f: K.F, c: K.C,
    });
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
    this.prevTJ = false; this.prevTA = false; this.prevTR = false;
  }
  left() { return this.k.left.isDown || this.k.a.isDown || touch.left || touch.axisX < 0; }
  right() { return this.k.right.isDown || this.k.d.isDown || touch.right || touch.axisX > 0; }
  /** -1..1 analog move. Keyboard is digital; the virtual stick is analog past its dead zone. */
  moveAxis() {
    const k = (this.k.right.isDown || this.k.d.isDown ? 1 : 0) - (this.k.left.isDown || this.k.a.isDown ? 1 : 0);
    if (k !== 0) return k;
    return touch.axisX || 0;
  }
  jumpHeld() { return this.k.space.isDown || this.k.up.isDown || this.k.w.isDown || this.k.z.isDown || touch.jump; }
  jumpPressed() {
    const J = Phaser.Input.Keyboard.JustDown;
    const kb = J(this.k.space) | J(this.k.up) | J(this.k.w) | J(this.k.z);
    const t = touch.jumpTap || (touch.jump && !this.prevTJ);
    touch.jumpTap = false; this.prevTJ = touch.jump;
    return !!(kb || t);
  }
  attackPressed() {
    const J = Phaser.Input.Keyboard.JustDown;
    const kb = J(this.k.x) | J(this.k.j);
    const t = touch.attackTap || (touch.attack && !this.prevTA);
    touch.attackTap = false; this.prevTA = touch.attack;
    return !!(kb || t);
  }
  rangedPressed() {
    const J = Phaser.Input.Keyboard.JustDown;
    const kb = J(this.k.f) | J(this.k.c);
    const t = touch.rangedTap || (touch.ranged && !this.prevTR);
    touch.rangedTap = false; this.prevTR = touch.ranged;
    return !!(kb || t);
  }
}
