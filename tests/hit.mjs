import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:4173/?play&debug'); await page.waitForTimeout(1500);
const info = await page.evaluate(() => { const s = window.__debug.scene; const sl = s.slimes[0]; s.player.setPosition(sl.x - 30, sl.y - 10); s.player.facing = 1; return { sx: sl.x, sy: sl.y, px: s.player.x }; });
console.log(info);
for (let i = 0; i < 4; i++) {
  await page.keyboard.down('KeyX'); await page.waitForTimeout(50); await page.keyboard.up('KeyX');
  for (let k = 0; k < 6; k++) { console.log(await page.evaluate(() => { const s = window.__debug.scene; const p = s.player; const hb = p.swordHitbox(); const sl = s.slimes[0]; return { att: p.attacking, f: p.anims.currentFrame && p.anims.currentFrame.textureFrame, key: p.anims.currentAnim && p.anims.currentAnim.key, hb: hb && [hb.x|0, hb.y|0, hb.width, hb.height], sl: sl && [sl.x|0, sl.y|0, sl.hp], px: p.x|0 }; })); await page.waitForTimeout(40); }
  await page.waitForTimeout(250);
}
await browser.close();
