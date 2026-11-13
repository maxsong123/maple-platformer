// Phone check: iPhone 13 landscape + portrait (touch, DPR 3).
// Verifies: virtual joystick + JUMP/ATK appear, tap-to-start, multitouch
// (hold stick right + tap JUMP), ATK swings, tilting the stick UP does not jump,
// page can't scroll, keyboard still works, portrait shows the rotate prompt.
// Screenshots: 06-mobile-touch.png, 06b-mobile-portrait.png,
//              09-joystick-landscape.png, 09b-joystick-portrait.png
import { chromium, devices } from 'playwright';
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = 'shots';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const iphone = devices['iPhone 13 landscape'] || { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const ctx = await browser.newContext({ ...iphone, viewport: { width: 844, height: 390 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const cdp = await ctx.newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);
const checks = {};
const ok = (n, c, detail) => { checks[n] = { pass: !!c, ...(detail !== undefined ? { detail } : {}) }; };

await page.goto(URL + '?debug', { waitUntil: 'networkidle' });
await wait(1500);
// game-space (640x360) -> CSS px, using the FIT-scaled canvas rect
const rect = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const toCss = (gx, gy) => ({ x: rect.x + gx * rect.w / 640, y: rect.y + gy * rect.h / 360 });
ok('canvas_fits_landscape', rect.w <= 844 && rect.h <= 390 && Math.abs(rect.h - 390) < 2, rect);
const touches = new Map();
const send = async (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...touches.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 8, radiusY: 8, force: 1 })) });
const press = async (id, p) => { touches.set(id, p); await send('touchStart'); };
const move = async (id, p) => { touches.set(id, p); await send('touchMove'); };
const lift = async (id) => { touches.delete(id); await send('touchEnd'); };

// tap to start
const c = toCss(320, 180);
await press(1, c); await wait(60); await lift(1);
await wait(1300);
const scene = await page.evaluate(() => !!(window.__debug && window.__debug.scene && window.__game.scene.isActive('Game')));
ok('tap_to_start', scene);
ok('touch_controls_shown', await page.evaluate(() => window.__game.scene.isActive('Touch')));
const audio = await page.evaluate(() => { const s = window.__game.sound; return s.context ? s.context.state : (s.locked === false ? 'unlocked' : 'locked'); });
ok('audio_unlocked_by_tap', audio === 'running' || audio === 'unlocked', audio);

const ui = await page.evaluate(() => window.__debug.touchUI);
ok('joystick_layout_exposed', !!(ui && ui.stick && ui.jump && ui.attack), ui);
const st = () => page.evaluate(() => { const p = window.__debug.scene.player; return { x: Math.round(p.x), y: Math.round(p.y), att: p.attacking, vy: Math.round(p.body.velocity.y) }; });
const axis = () => page.evaluate(() => { const t = window.__debug.scene.controls; return { ax: window.__debug.touchUI ? undefined : 0, left: t.left(), right: t.right(), jump: t.jumpHeld(), axis: t.moveAxis() }; });

const s0 = await st();
// Place finger on the stick home, then drag it to the right (analog move).
const stickHome = toCss(ui.stick.x, ui.stick.y);
const stickRight = toCss(ui.stick.x + ui.stick.maxR, ui.stick.y);
const J = toCss(ui.jump.x, ui.jump.y);
const A = toCss(ui.attack.x, ui.attack.y);

await press(1, stickHome); await wait(80);
await move(1, stickRight); await wait(500);
const moved = await st();
ok('hold_stick_right_moves', moved.x - s0.x > 80, { from: s0.x, to: moved.x });

// while holding the stick, tap JUMP with a second finger (multitouch)
await press(2, J); await wait(140);
const air = await st();
await page.screenshot({ path: `${OUT}/09-joystick-landscape.png` });
// keep a copy at the legacy name too so older docs still resolve
await page.screenshot({ path: `${OUT}/06-mobile-touch.png` });
ok('multitouch_jump_while_running', air.y < s0.y - 15, { groundY: s0.y, airY: air.y });
await lift(2); await wait(600);
const s1 = await st();
ok('kept_moving_after_jump', s1.x - s0.x > 100, { from: s0.x, to: s1.x });
await lift(1);
// wait until the hero is on the ground again before the next check
for (let i = 0; i < 20; i++) {
  await wait(100);
  const cur = await st();
  if (cur.vy === 0 && cur.y >= 0) { break; }
}

// tilting the stick UP must not jump
const grounded = await st();
const stickUp = toCss(ui.stick.x, ui.stick.y - ui.stick.maxR);
await press(1, stickHome); await wait(40);
await move(1, stickUp); await wait(220);
const upped = await st();
const ax = await page.evaluate(() => {
  // TouchState is not on window; infer from player + jumpHeld
  return {
    jumpHeld: window.__debug.scene.controls.jumpHeld(),
    axis: window.__debug.scene.controls.moveAxis(),
  };
});
ok('stick_up_does_not_jump', upped.y >= grounded.y - 8 && !ax.jumpHeld, { groundY: grounded.y, y: upped.y, ...ax });
await lift(1); await wait(300);

await press(3, A); await wait(60);
const sw = await st(); await lift(3);
ok('attack_button_swings', sw.att);

// try to scroll / pinch the page
await page.evaluate(() => window.scrollTo(0, 500));
await press(4, { x: 400, y: 300 }); touches.set(4, { x: 400, y: 50 }); await send('touchMove'); await lift(4);
ok('page_does_not_scroll', await page.evaluate(() => window.scrollY === 0 && document.scrollingElement.scrollTop === 0));
const kb = await page.evaluate(() => window.__debug.scene.controls.k.right !== undefined);
ok('keyboard_still_wired', kb);

// portrait -> rotate prompt (game is landscape-first; prompt covers the canvas)
await page.setViewportSize({ width: 390, height: 844 });
await wait(500);
ok('portrait_rotate_prompt', await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display !== 'none'));
await page.screenshot({ path: `${OUT}/09b-joystick-portrait.png` });
await page.screenshot({ path: `${OUT}/06b-mobile-portrait.png` });
ok('no_js_errors', errors.length === 0, errors.slice(0, 5));
await browser.close();
const passed = Object.values(checks).every((x) => x.pass);
console.log(JSON.stringify({ passed, checks }, null, 1));
process.exit(passed ? 0 : 1);
