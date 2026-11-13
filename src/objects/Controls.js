import Phaser from 'phaser';
import { touch } from './TouchState.js';

/** Keyboard + on-screen touch mapping: arrows/WASD move, Space/Up/W jump, X/J attack. */
export default class Controls {
  constructor(scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = scene.input.keyboard;
    this.k = kb.addKeys({
      left: K.LEFT, right: K.RIGHT, up: K.UP, a: K.A, d: K.D, w: K.W,
      space: K.SPACE, x: K.X, j: K.J, z: K.Z,
    });
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
    this.prevTJ = false; this.prevTA = false;
  }
  left() { return this.k.left.isDown || this.k.a.isDown || touch.left; }
  right() { return this.k.right.isDown || this.k.d.isDown || touch.right; }
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
}
