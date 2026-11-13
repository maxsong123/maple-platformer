// Phone check: iPhone-landscape emulation (844x390, touch, DPR 3).
// Verifies: touch buttons appear, tap-to-start, multitouch (hold RIGHT + tap JUMP), ATK swings,
// page can't scroll, portrait shows the rotate prompt. Screenshots: 06-mobile-touch.png, 06b-mobile-portrait.png
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

const st = () => page.evaluate(() => { const p = window.__debug.scene.player; return { x: Math.round(p.x), y: Math.round(p.y), att: p.attacking }; });
const s0 = await st();
// hold RIGHT (finger 1) and, while holding, tap JUMP (finger 2) -> multitouch
const R = toCss(146, 288), J = toCss(578, 274), A = toCss(490, 296);
await press(1, R); await wait(500);
await press(2, J); await wait(140);
const air = await st();
await page.screenshot({ path: `${OUT}/06-mobile-touch.png` });
await lift(2); await wait(600);
const s1 = await st();
ok('hold_right_moves', s1.x - s0.x > 100, { from: s0.x, to: s1.x });
ok('multitouch_jump_while_running', air.y < s0.y - 15, { groundY: s0.y, airY: air.y });
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

// portrait -> rotate prompt
await page.setViewportSize({ width: 390, height: 844 });
await wait(500);
ok('portrait_rotate_prompt', await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display !== 'none'));
await page.screenshot({ path: `${OUT}/06b-mobile-portrait.png` });
ok('no_js_errors', errors.length === 0, errors.slice(0, 5));
await browser.close();
const passed = Object.values(checks).every((x) => x.pass);
console.log(JSON.stringify({ passed, checks }, null, 1));
process.exit(passed ? 0 : 1);
