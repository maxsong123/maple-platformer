// Headless smoke test: loads the game, plays a bit, saves screenshots + a video.
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = 'shots';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: '/tmp/mpvid', size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const tap = async (key) => { await page.keyboard.down(key); await wait(60); await page.keyboard.up(key); };
const state = () => page.evaluate(() => {
  const d = window.__debug; if (!d) return null; const s = d.scene;
  return { x: Math.round(s.player.x), y: Math.round(s.player.y), hp: s.player.hp, coins: s.run.coins, kills: s.run.kills, slimes: s.slimes.length, lvl: s.prog.level, xp: s.prog.xp, done: s.completed };
});

await page.goto(URL + '?debug', { waitUntil: 'networkidle' });
await wait(1800);
await page.screenshot({ path: `${OUT}/01-title.png` });
await tap('Space');
await wait(900);
console.log('start', await state());

// play: run right, jump onto first ledge, swing at things
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 14; i++) {
  if (i % 3 === 0) { await page.keyboard.down('Space'); await wait(220); await page.keyboard.up('Space'); }
  await tap('KeyX');
  await wait(260);
  if (i === 9) await page.screenshot({ path: `${OUT}/02-midlevel.png` });
}
await page.keyboard.up('ArrowRight');
console.log('after run', await state());

// fight the first slime: position near it and swing
for (let i = 0; i < 8; i++) {
  const st = await state();
  const sl = await page.evaluate(() => { const s = window.__debug.scene; const a = s.slimes.filter(z=>!z.dead).sort((p,q)=>Math.abs(p.x-s.player.x)-Math.abs(q.x-s.player.x))[0]; return a ? Math.round(a.x) : null; });
  if (sl == null) break;
  const key = sl > st.x ? 'ArrowRight' : 'ArrowLeft';
  if (Math.abs(sl - st.x) > 40) await hold(key, Math.min(600, Math.abs(sl - st.x) * 4));
  else { await hold(key, 30); await tap('KeyX'); await wait(320); }
  if (i === 3) await page.screenshot({ path: `${OUT}/02b-combat.png` });
}
console.log('after fight', await state());
await page.screenshot({ path: `${OUT}/02c-after-fight.png` });

// jump near the goal and walk in
const goalX = await page.evaluate(() => Math.round(window.__debug.scene.portal.x / 32));
await page.evaluate((gx) => window.__debug.teleport(gx - 8), goalX);
await wait(500);
await hold('ArrowRight', 2200);
await wait(2600);
console.log('end', await state(), await page.evaluate(() => window.__levelComplete || null));
await page.screenshot({ path: `${OUT}/03-level-complete.png` });

await ctx.close();
const vids = fs.readdirSync('/tmp/mpvid').map(f => '/tmp/mpvid/' + f).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
console.log('video', vids[0]);
console.log('errors', JSON.stringify(errors.slice(0, 20), null, 1));
await browser.close();
