import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config/tuning.js';
import { touch, TOUCH_UI, resetTouch } from '../objects/TouchState.js';

/**
 * On-screen virtual joystick (left) + jump/attack buttons (right).
 * Shown only on touch devices (or with ?touch). Multi-touch: the stick tracks one
 * pointer while JUMP / ATK can be pressed with another. Tilting the stick up
 * never jumps — jump is the button (or the keyboard) only.
 *
 * The stick is floating: a faint base sits at a default spot, but the first
 * touch in the left zone recenters it under the thumb (clamped). On release it
 * eases back to the default. The knob is analog past a dead zone.
 */
export default class TouchScene extends Phaser.Scene {
  constructor() { super('Touch'); }

  create() {
    touch.enabled = true;
    this.input.addPointer(3); // up to 4 simultaneous touches

    this.stickHome = { x: TOUCH_UI.stick.x, y: TOUCH_UI.stick.y };
    this.baseX = this.stickHome.x;
    this.baseY = this.stickHome.y;
    this.stickPtr = null; // pointer id currently driving the stick, or null

    this.stick = this.makeStick(this.baseX, this.baseY);
    this.btns = [
      this.makeBtn('ranged', TOUCH_UI.attack.x, TOUCH_UI.attack.y - 68, 28, 'star', 44),
      this.makeBtn('attack', TOUCH_UI.attack.x, TOUCH_UI.attack.y, TOUCH_UI.attack.r, 'sword', TOUCH_UI.attack.hitR),
      this.makeBtn('jump', TOUCH_UI.jump.x, TOUCH_UI.jump.y, TOUCH_UI.jump.r, 'arrowU', TOUCH_UI.jump.hitR),
    ];

    this.input.on('pointerdown', (ptr) => this.onDown(ptr));
    this.input.on('pointerup', (ptr) => this.onUp(ptr));
    this.input.on('pointerupoutside', (ptr) => this.onUp(ptr));
    this.input.on('pointermove', (ptr) => this.onMove(ptr));

    this.events.once('shutdown', () => this.release());
    this.game.events.on('blur', this.release, this);
    this.events.once('shutdown', () => this.game.events.off('blur', this.release, this));

    // expose layout for Playwright (and merge with ?debug hooks)
    const ui = {
      stick: { ...TOUCH_UI.stick, x: this.baseX, y: this.baseY },
      jump: { ...TOUCH_UI.jump },
      attack: { ...TOUCH_UI.attack },
    };
    window.__debug = Object.assign(window.__debug || {}, { touchUI: ui });
  }

  onDown(ptr) {
    for (const b of this.btns) {
      if (this.hitBtn(b, ptr)) {
        if (b.key === 'jump') touch.jumpTap = true;
        if (b.key === 'attack') touch.attackTap = true;
        if (b.key === 'ranged') touch.rangedTap = true;
        return; // a button ate this pointer; don't also grab the stick
      }
    }
    if (this.stickPtr == null && this.inLeftZone(ptr)) {
      this.stickPtr = ptr.id;
      const pos = this.clampBase(ptr.x, ptr.y);
      this.baseX = pos.x;
      this.baseY = pos.y;
      this.placeStick(this.baseX, this.baseY);
      this.applyStick(ptr.x, ptr.y);
    }
  }

  onMove(ptr) {
    if (this.stickPtr === ptr.id && ptr.isDown) this.applyStick(ptr.x, ptr.y);
  }

  onUp(ptr) {
    if (this.stickPtr === ptr.id) {
      this.stickPtr = null;
      this.resetStick();
    }
  }

  inLeftZone(ptr) {
    return ptr.x < GAME_W * TOUCH_UI.leftZone;
  }

  clampBase(x, y) {
    const m = TOUCH_UI.stick.maxR + 10;
    return {
      x: Phaser.Math.Clamp(x, m, GAME_W * TOUCH_UI.leftZone - 8),
      y: Phaser.Math.Clamp(y, m, GAME_H - 8),
    };
  }

  applyStick(px, py) {
    const { maxR, dead } = TOUCH_UI.stick;
    let dx = px - this.baseX;
    let dy = py - this.baseY;
    const mag = Math.hypot(dx, dy) || 0;
    if (mag > maxR) {
      dx = (dx / mag) * maxR;
      dy = (dy / mag) * maxR;
    }
    this.setKnob(this.baseX + dx, this.baseY + dy);

    const nx = dx / maxR;
    const ny = dy / maxR;
    const remap = (v) => {
      const a = Math.abs(v);
      if (a <= dead) return 0;
      return Math.sign(v) * Math.min(1, (a - dead) / (1 - dead));
    };
    touch.axisX = remap(nx);
    touch.axisY = remap(ny);
    touch.left = touch.axisX < 0;
    touch.right = touch.axisX > 0;
    // axisY is intentionally not wired to jump
  }

  resetStick() {
    touch.axisX = touch.axisY = 0;
    touch.left = touch.right = false;
    this.baseX = this.stickHome.x;
    this.baseY = this.stickHome.y;
    this.placeStick(this.baseX, this.baseY);
    this.setKnob(this.baseX, this.baseY);
    if (window.__debug && window.__debug.touchUI) {
      window.__debug.touchUI.stick.x = this.baseX;
      window.__debug.touchUI.stick.y = this.baseY;
    }
  }

  release() {
    this.stickPtr = null;
    this.resetStick();
    resetTouch();
  }

  hitBtn(b, ptr) { return Phaser.Math.Distance.Between(ptr.x, ptr.y, b.x, b.y) <= b.hitR; }

  makeStick(x, y) {
    const { baseR, knobR, dead, maxR } = TOUCH_UI.stick;
    const base = this.add.container(x, y).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x1d2b53, 0.32).fillCircle(0, 0, baseR);
    g.lineStyle(3, 0xffffff, 0.45).strokeCircle(0, 0, baseR);
    // dead-zone ring
    g.lineStyle(1, 0xffffff, 0.25).strokeCircle(0, 0, maxR * dead);
    // faint cross so the rest position is obvious
    g.lineStyle(1, 0xffffff, 0.2);
    g.lineBetween(-baseR * 0.45, 0, baseR * 0.45, 0);
    g.lineBetween(0, -baseR * 0.45, 0, baseR * 0.45);
    base.add(g);
    base.setAlpha(0.7);

    const knob = this.add.container(x, y).setDepth(101);
    const kg = this.add.graphics();
    kg.fillStyle(0x1d2b53, 0.55).fillCircle(0, 0, knobR);
    kg.lineStyle(3, 0xffffff, 0.7).strokeCircle(0, 0, knobR);
    kg.fillStyle(0xffffff, 0.35).fillCircle(0, -2, knobR * 0.45);
    knob.add(kg);
    knob.setAlpha(0.8);

    this.stickBase = base;
    this.stickKnob = knob;
    return { base, knob };
  }

  placeStick(x, y) {
    this.stickBase.setPosition(x, y);
    this.setKnob(x, y);
  }

  setKnob(x, y) {
    this.stickKnob.setPosition(x, y);
  }

  makeBtn(key, x, y, r, icon, hitR) {
    const c = this.add.container(x, y).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x1d2b53, 0.38).fillCircle(0, 0, r);
    g.lineStyle(3, 0xffffff, 0.55).strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.8);
    const s = r * 0.42;
    if (icon === 'arrowU') g.fillTriangle(0, -s, -s, s * 0.6, s, s * 0.6);
    if (icon === 'sword') {
      g.lineStyle(4, 0xffffff, 0.85).lineBetween(-s * 0.7, s * 0.7, s * 0.8, -s * 0.8);
      g.lineStyle(4, 0xffe066, 0.85).lineBetween(-s * 0.9, s * 0.1, -s * 0.1, s * 0.9);
    }
    if (icon === 'star') {
      const t = s * 0.95, w = s * 0.34;
      g.fillStyle(0xcfe8ff, 0.9);
      g.fillTriangle(0, -t, w, 0, -w, 0);
      g.fillTriangle(0, t, w, 0, -w, 0);
      g.fillTriangle(-t, 0, 0, w, 0, -w);
      g.fillTriangle(t, 0, 0, w, 0, -w);
    }
    c.add(g);
    const label = { jump: 'JUMP', attack: 'ATK', ranged: 'THROW' }[key];
    if (label) c.add(this.add.text(0, r * 0.55, label, { fontFamily: 'PressStart', fontSize: '6px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.8));
    c.setAlpha(0.6);
    return { key, x, y, r, hitR, c, down: false };
  }

  update() {
    // Follow the stick pointer every frame. Synthetic Playwright touches
    // sometimes skip pointermove, but the pointer stays down with a new position.
    if (this.stickPtr != null) {
      const p = this.input.manager.pointers.find((q) => q.id === this.stickPtr && q.isDown);
      if (p) this.applyStick(p.x, p.y);
      else this.onUp({ id: this.stickPtr });
    }
    const ptrs = this.input.manager.pointers.filter((p) => p.isDown);
    for (const b of this.btns) {
      const down = ptrs.some((p) => this.hitBtn(b, p) && p.id !== this.stickPtr);
      touch[b.key] = down;
      if (down !== b.down) {
        b.down = down;
        this.tweens.killTweensOf(b.c);
        this.tweens.add({ targets: b.c, scale: down ? 0.88 : 1, alpha: down ? 0.95 : 0.6, duration: 70 });
      }
    }
    // light feedback on the knob while the stick is held
    const held = this.stickPtr != null;
    this.stickKnob.setAlpha(held ? 0.95 : 0.8);
    this.stickBase.setAlpha(held ? 0.85 : 0.7);
  }
}
