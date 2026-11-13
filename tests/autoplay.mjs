// Bot that plays the whole level end-to-end and checks the v2 features:
//   1. touches the mid-level checkpoint  -> screenshot 04-checkpoint.png
//   2. forced K.O. -> must respawn AT that checkpoint with full hearts
//   3. reaches the arena, fights King Slime (dodges shockwaves/charges, swings when safe) -> 05-boss.png
//   4. boss must enrage at 50%, die, unlock the portal; bot walks into the portal -> 03-level-complete.png
// Saves a full-run video and writes timing so tools/make_clip.sh can cut the boss clip.
// Usage: npm run preview (port 4173) in another shell, then: node tests/autoplay.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = 'shots';
const STATS = process.env.STATS ? '&stats=' + encodeURIComponent(process.env.STATS) : '';
fs.rmSync('/tmp/mpvid', { recursive: true, force: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: '/tmp/mpvid', size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const vid0 = Date.now();
const vt = () => (Date.now() - vid0) / 1000;
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const wait = (ms) => page.waitForTimeout(ms);
const checks = {};
const ok = (name, cond, detail) => { checks[name] = { pass: !!cond, ...(detail ? { detail } : {}) }; };
const info = () => page.evaluate(() => window.__debug && window.__debug.info());

await page.goto(URL + '?debug' + STATS, { waitUntil: 'networkidle' });
await wait(1500);
if (!process.env.START) await page.screenshot({ path: `${OUT}/01-title.png` });
await page.keyboard.press('Space');
await wait(800);
const BOSS_ONLY = process.env.START === 'boss'; // quick boss-tuning mode: skip to the pre-boss checkpoint
if (BOSS_ONLY) {
  await wait(600);
  await page.evaluate(() => { const s = window.__debug.scene; const c = s.checkpoints[1]; s.player.setPosition(c.respawn.x - 40, c.respawn.y); });
}

const down = new Set();
const setKey = async (k, on) => { if (on && !down.has(k)) { await page.keyboard.down(k); down.add(k); } if (!on && down.has(k)) { await page.keyboard.up(k); down.delete(k); } };
const releaseAll = async () => { for (const k of [...down]) await setKey(k, false); };

let shotMid = false, shotCp = false, shotBoss = false, cpTested = false, done = false;
let fightStartAt = null, bossDeadAt = null, enragedSeen = false, maxMinis = 0, bossDeaths = 0, attacksSeen = new Set();
const start = Date.now();
while (!done && Date.now() - start < (Number(process.env.TIMEOUT) || 300000)) {
  const d = await page.evaluate(() => {
    const s = window.__debug && window.__debug.scene; if (!s || !s.player) return { wait: true };
    if (s.completed) return { done: true };
    const p = s.player, L = s.layer;
    const live = s.slimes.filter((z) => !z.dead);
    const near = live.filter((z) => Math.abs(z.x - p.x) < 70 && Math.abs(z.y - p.y) < 40).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    const grounded = p.body.blocked.down;
    const ahead = (dx, dy) => L.getTileAtWorldXY(p.x + dx, p.body.bottom + dy);
    const k = s.boss;
    const shock = s.shocks.map((w) => ({ dx: w.spr.x - p.x, dir: w.dir })).filter((w) => Math.sign(-w.dx) === w.dir || Math.abs(w.dx) < 20)
      .sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx))[0] || null;
    return {
      dmgNum: s.children.list.some((c) => c.type === 'Container'),
      near: near ? { dx: near.x - p.x } : null, grounded,
      pitAhead: grounded && !ahead(34, 6) && !ahead(50, 6),
      wallAhead: !!L.getTileAtWorldXY(p.x + 20, p.y),
      vy: p.body.velocity.y, x: p.x, y: p.y, dead: p.dead, hp: p.hp, attacking: p.attacking,
      onScreen: live.filter((z) => Math.abs(z.x - p.x) < 300).length,
      cps: s.checkpoints.map((c) => c.isActive), fight: s.fight, portalLocked: s.portalLocked, portalX: s.portal.x,
      boss: k && s.fight === 'active' ? { dx: k.x - p.x, state: k.state, next: k.nextAttack, dir: k.dir, hp: k.hp, max: k.maxHp, enraged: k.enraged, dead: k.dead, vy: k.body.velocity.y, airborne: !k.body.blocked.down } : null,
      shock, minis: live.filter((z) => z.mini).length, deaths: s.run.deaths,
    };
  });
  if (d.done) { done = true; break; }
  if (d.wait || d.dead) { await releaseAll(); await wait(100); continue; }

  // ── checkpoint screenshot + respawn test (once, at the first checkpoint)
  if (!BOSS_ONLY && !shotCp && d.cps[0]) { await wait(260); await page.screenshot({ path: `${OUT}/04-checkpoint.png` }); shotCp = true; }
  if (!BOSS_ONLY && shotCp && !cpTested) {
    cpTested = true;
    await releaseAll();
    // walk a bit past the flag first so a correct respawn is clearly distinguishable
    await setKey('ArrowRight', true); await wait(700); await setKey('ArrowRight', false);
    const before = await info();
    await page.evaluate(() => window.__debug.killPlayer());
    await wait(400);
    const mid = await info();
    await wait(2200);
    const after = await info();
    ok('death_triggers_at_0_hearts', mid.dead && mid.hp === 0, { hp: mid.hp });
    ok('respawn_at_checkpoint', !after.dead && Math.abs(after.x - after.respawn.x) < 24 && after.respawn.x !== 48 && after.checkpoints[0], { x: after.x, respawn: after.respawn, diedAt: before.x });
    ok('respawn_full_hearts', after.hp === after.maxHp, { hp: after.hp });
    ok('death_counted', after.deaths === 1);
    continue;
  }

  let right = true, left = false, jump = false, attack = false;
  if (d.boss && !d.boss.dead) {
    // ── boss AI
    const b = d.boss; attacksSeen.add(b.state);
    if (b.enraged) enragedSeen = true;
    const adx = Math.abs(b.dx), toward = Math.sign(b.dx); // +1 boss is to the right
    right = false; left = false;
    const AL = 6450, AR = 7410; // arena interior
    const away = () => { if (toward > 0) left = true; else right = true; };
    // dodge toward open space: if the wall behind us is close, slip under/past the boss instead
    const dodge = () => {
      const roomBehind = toward > 0 ? d.x - AL : AR - d.x;
      if (roomBehind > 140) away(); else { if (toward > 0) right = true; else left = true; if (adx < 120) jump = true; }
    };
    const approach = () => { if (toward > 0) right = true; else left = true; };
    if (b.state === 'charge') {
      // boss rushing at us: jump over it when it gets close
      const coming = Math.sign(-b.dx) === b.dir;
      if (coming && adx < 150) { jump = true; away(); approach(); left = right = false; if (b.dir > 0) right = true; else left = true; }
      else if (coming) away();
    } else if (b.state === 'slam') {
      if (!b.airborne || adx < 200) dodge(); // it lands where we were standing: get out from under it
    } else if (b.state === 'telegraph') {
      if (b.next === 'slam' && adx < 160) dodge();
      else if (b.next === 'charge') { /* hold position, get ready to jump */ }
      else if (adx > 80) approach();
    } else {
      // idle / dizzy / summon -> get in sword range and swing
      if (adx > 74) approach(); else if (adx < 64) away();
      if (adx < 84) attack = true;
    }
    if (d.near && Math.abs(d.near.dx) < 50) { attack = true; }
    if (d.shock && Math.abs(d.shock.dx) < 64 && d.grounded) jump = true;

    if (!d.grounded && d.vy < 0) jump = true;
    if (b.enraged) enragedSeen = true;
    maxMinis = Math.max(maxMinis, d.minis);
    // boss screenshot: enraged wind-up (the red '!'), boss on screen, not mid hit-flash
    if (!shotBoss && b.enraged && b.state === 'telegraph' && adx < 280 && adx > 90) { await wait(150); if (!BOSS_ONLY || process.env.SHOT05) await page.screenshot({ path: `${OUT}/05-boss.png` }); shotBoss = true; }
  } else if (d.fight === 'won' && d.portalLocked) {
    right = false; // wait for the portal to unlock (death animation)
    if (d.near && Math.abs(d.near.dx) < 60) attack = true;
  } else {
    // ── level AI (unchanged): run right, swing at slimes, hop pits/walls
    if (d.near) {
      right = d.near.dx > 18; left = d.near.dx < -6;
      if (Math.abs(d.near.dx) < 60) attack = true;
      if (Math.abs(d.near.dx) < 14) { right = false; left = true; }
    }
    if (d.pitAhead || d.wallAhead) jump = true;
    if (!d.grounded && d.vy < 0) jump = true;
  }
  if (d.fight === 'active' && fightStartAt === null) fightStartAt = vt();
  if (d.fight === 'won' && bossDeadAt === null) bossDeadAt = vt();
  if (d.fight === 'none' && fightStartAt !== null && bossDeadAt === null && d.deaths > 1) { bossDeaths = d.deaths - 1; }
  await setKey('ArrowRight', right); await setKey('ArrowLeft', left); await setKey('Space', jump);
  if (attack && !d.attacking) { await page.keyboard.down('KeyX'); await wait(30); await page.keyboard.up('KeyX'); }
  if (!BOSS_ONLY && !shotMid && d.onScreen >= 2 && d.dmgNum && !d.boss) { await wait(60); await page.screenshot({ path: `${OUT}/02-midlevel.png` }); shotMid = true; }
  await wait(40);
}
await releaseAll();
const gameEnd = vt();
const final = await info().catch(() => null);
await wait(3400);
if (!BOSS_ONLY) await page.screenshot({ path: `${OUT}/03-level-complete.png` });
const result = await page.evaluate(() => window.__levelComplete || null);
if (!BOSS_ONLY) ok('mid_checkpoint_touched', shotCp);
ok('boss_fight_started', fightStartAt !== null);
ok('boss_enraged_at_50pct', enragedSeen);
ok('boss_used_attacks', ['slam', 'charge'].some((a) => attacksSeen.has(a)) && attacksSeen.has('telegraph'), [...attacksSeen]);
if (!BOSS_ONLY) ok('boss_screenshot', shotBoss);
ok('boss_defeated', !!(result && result.bossDefeated));
ok('portal_unlocked_and_level_cleared', done && !!result);
ok('no_js_errors', errors.length === 0, errors.slice(0, 5));
await ctx.close();
await browser.close();
const vid = fs.readdirSync('/tmp/mpvid').map((f) => '/tmp/mpvid/' + f)[0];
fs.writeFileSync('/tmp/mp-timing.json', JSON.stringify({ fightStartAt, bossDeadAt, gameEnd, vid }));
const passed = Object.values(checks).every((c) => c.pass);
console.log(JSON.stringify({ passed, checks, hurtBy: final && final.hurtBy, deaths: final && final.deaths, bossHp: final && final.boss, result, maxMinis, fightStartAt, bossDeadAt, gameEnd, vid }, null, 1));
process.exit(passed ? 0 : 1);
