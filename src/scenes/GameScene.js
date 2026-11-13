import Phaser from 'phaser';
import { TILE, GAME_W, GAME_H, COMBAT, ENEMY, PROGRESSION, BOSS, CHECKPOINT } from '../config/tuning.js';
import { getPlayerStats } from '../config/stats.js';
import { buildLevel1 } from '../levels/level1.js';
import Player from '../objects/Player.js';
import Slime from '../objects/Slime.js';
import KingSlime from '../objects/KingSlime.js';
import Checkpoint from '../objects/Checkpoint.js';
import Controls from '../objects/Controls.js';
import { touch, isTouchDevice } from '../objects/TouchState.js';
import Juice from '../fx/Juice.js';

// tile indices in tiles.png
const T = { GL: 0, GM: 1, GR: 2, DL: 3, DM: 4, DR: 5, LL: 6, LM: 7, LR: 8 };
const R = Phaser.Geom.Rectangle;
const hits = Phaser.Geom.Intersects.RectangleToRectangle;

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.juice = new Juice(this);
    this.stats = getPlayerStats();
    this.level = buildLevel1();
    this.run = { coins: 0, xp: 0, kills: 0, startedAt: this.time.now, hpLost: 0, deaths: 0, bossDefeated: false };
    this.prog = this.registry.get('prog') || { level: 1, xp: 0 };
    this.coinCombo = 0; this.lastCoinAt = 0;
    this.completed = false;
    this.fight = 'none'; // none | active | won
    this.shocks = [];

    const rows = this.level.rows;
    const W = rows[0].length * TILE, H = rows.length * TILE;
    this.worldW = W; this.worldH = H;
    this.physics.world.setBounds(0, 0, W, H + 200);
    this.physics.world.setBoundsCollision(true, true, false, false);

    this.makeBackground();
    this.makeTilemap(rows);
    this.spawnEntities(rows);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 30);
    cam.setDeadzone(40, 50);
    cam.setRoundPixels(true);
    cam.fadeIn(350, 0, 0, 0);

    this.scene.launch('HUD', { game: this });
    if (isTouchDevice()) this.scene.launch('Touch');
    this.events.once('shutdown', () => { this.scene.stop('HUD'); this.scene.stop('Touch'); });

    if (!this.sound.get('music')) this.sound.add('music', { loop: true, volume: 0.28 });
    const m = this.sound.get('music');
    if (!m.isPlaying && !this.registry.get('muted')) m.play();

    this.input.keyboard.on('keydown-M', () => this.toggleMute());
    this.input.keyboard.on('keydown-R', () => this.scene.restart());

    // debug hooks for automated testing (?debug)
    if (new URLSearchParams(location.search).has('debug')) {
      window.__debug = Object.assign(window.__debug || {}, {
        scene: this,
        teleport: (tx, ty = 6) => { this.player.setPosition(tx * TILE, ty * TILE); this.player.body.setVelocity(0, 0); },
        killPlayer: () => this.hurtPlayer(99, this.player.x + 1, this.time.now, true),
        info: () => ({
          x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp, maxHp: this.stats.maxHp, dead: this.player.dead,
          deaths: this.run.deaths, checkpoints: this.checkpoints.map((c) => c.isActive),
          respawn: this.respawnPoint, fight: this.fight, portalLocked: this.portalLocked,
          boss: this.boss ? { hp: this.boss.hp, max: this.boss.maxHp, state: this.boss.state, enraged: this.boss.enraged, x: Math.round(this.boss.x), dead: this.boss.dead } : null,
          minis: this.slimes.filter((z) => z.mini && !z.dead).length, completed: this.completed, hurtBy: this.run.hurtBy || {},
        }),
      });
    }
  }

  toggleMute() {
    const muted = !this.registry.get('muted');
    this.registry.set('muted', muted);
    this.sound.mute = muted;
    return muted;
  }

  makeBackground() {
    const mk = (key, factor, y = 0, depth = -10) => {
      const ts = this.add.tileSprite(0, y, GAME_W, GAME_H, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      ts.factor = factor; return ts;
    };
    this.bg = [mk('bg_sky', 0, 0, -14), mk('bg_clouds', 0.08, 0, -13), mk('bg_far', 0.2, 0, -12), mk('bg_near', 0.45, 10, -11)];
  }

  makeTilemap(rows) {
    const at = (x, y) => (rows[y] && rows[y][x]) || '.';
    const data = rows.map((r, y) => [...r].map((ch, x) => {
      if (ch === '#') {
        const top = at(x, y - 1) !== '#';
        const l = at(x - 1, y) !== '#', rr = at(x + 1, y) !== '#';
        if (top) return l ? T.GL : rr ? T.GR : T.GM;
        return l ? T.DL : rr ? T.DR : T.DM;
      }
      if (ch === '=') {
        const l = at(x - 1, y) !== '=', rr = at(x + 1, y) !== '=';
        return l ? T.LL : rr ? T.LR : T.LM;
      }
      return -1;
    }));
    this.map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tiles = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    this.layer = this.map.createLayer(0, tiles, 0, 0).setDepth(5);
    this.layer.setCollision([T.GL, T.GM, T.GR, T.DL, T.DM, T.DR, T.LL, T.LM, T.LR]);
    this.layer.forEachTile((t) => { if (t.index >= T.LL) t.setCollision(false, false, true, false); });
  }

  spawnEntities(rows) {
    this.slimes = [];
    this.checkpoints = [];
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
    this.drops = this.physics.add.group();
    this.totalCoins = 0;
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const wx = x * TILE + TILE / 2, wy = y * TILE + TILE / 2;
      if (ch === 'P') this.spawn = { x: wx, y: wy };
      if (ch === 'o') {
        const c = this.coins.create(wx, wy, 'coin').play({ key: 'coin-spin', startFrame: (x + y) % 6 });
        c.body.setSize(14, 14); c.setDepth(12);
        this.tweens.add({ targets: c, y: wy - 3, yoyo: true, repeat: -1, duration: 600 + (x % 3) * 80, ease: 'Sine.InOut' });
        this.totalCoins++;
      }
      if (ch === 's') this.slimes.push(new Slime(this, wx, wy, this.layer));
      if (ch === 'C') this.checkpoints.push(new Checkpoint(this, wx, (y + 1) * TILE, this.checkpoints.length));
      if (ch === 'K') this.bossHome = { x: wx, y: wy - 30 };
      if (ch === 'A') this.gateX = x * TILE;
      if (ch === 'G') {
        this.portal = this.physics.add.sprite(wx, wy - 16, 'portal').play('portal-swirl').setDepth(8);
        this.portal.body.setAllowGravity(false).setSize(24, 50);
        this.tweens.add({ targets: this.portal, scaleX: { from: 1, to: 1.06 }, yoyo: true, repeat: -1, duration: 500 });
        this.portalLabel = this.add.text(wx, wy - 58, 'GOAL', { fontFamily: 'PressStart', fontSize: '8px', color: '#ffffff', stroke: '#1d2b53', strokeThickness: 4 }).setOrigin(0.5).setDepth(9);
      }
    }));
    this.totalSlimes = this.slimes.length;
    this.groundTop = 10 * TILE;

    this.controls = new Controls(this);
    this.player = new Player(this, this.spawn.x, this.spawn.y, this.stats, this.controls);
    this.lastSafe = { ...this.spawn };
    this.respawnPoint = { ...this.spawn };

    // boss + arena gate (magic barrier that seals you in once the fight starts)
    if (this.bossHome) {
      this.boss = new KingSlime(this, this.bossHome.x, this.bossHome.y);
      // the King is too heavy for the floating ledges: he only stands on solid ground (so ledges are your safe spots from shockwaves + charges)
      this.physics.add.collider(this.boss, this.layer, null, (b, tile) => tile.index < T.LL);
      this.gate = this.add.rectangle(this.gateX + 8, this.groundTop - 120, 16, 240, 0xc28bff, 0.45).setDepth(18).setStrokeStyle(2, 0xffffff, 0.8).setVisible(false);
      this.physics.add.existing(this.gate, true);
      this.gate.body.enable = false;
      this.physics.add.collider(this.player, this.gate);
      this.physics.add.collider(this.boss, this.gate);
      this.lockPortal(true);
    }

    this.physics.add.collider(this.player, this.layer);
    this.slimes.forEach((s) => this.physics.add.collider(s, this.layer));
    this.physics.add.collider(this.drops, this.layer);
    this.physics.add.overlap(this.player, this.coins, (p, c) => this.collectCoin(c));
    this.physics.add.overlap(this.player, this.drops, (p, c) => { if (c.getData('ready')) this.collectCoin(c); });
    this.physics.add.overlap(this.player, this.portal, () => this.tryPortal());
  }

  // ───────────── portal lock ─────────────
  lockPortal(locked) {
    this.portalLocked = locked;
    if (locked) {
      this.portal.setTint(0x6a6f8a).setAlpha(0.55);
      this.portal.anims.pause();
      this.portalLabel.setText('LOCKED').setColor('#c9cfe8');
    } else {
      this.portal.clearTint().setAlpha(1);
      this.portal.anims.resume();
      this.portalLabel.setText('GOAL').setColor('#ffffff');
      this.tweens.add({ targets: this.portal, scale: { from: 1.6, to: 1 }, duration: 500, ease: 'Back.Out' });
      this.juice.sparkleBurst(this.portal.x, this.portal.y, 16);
      this.juice.floatText(this.portal.x, this.portal.y - 50, 'PORTAL OPEN!', '#9dff7a', 10);
    }
  }

  tryPortal() {
    if (!this.portalLocked) return this.finish();
    if (this.time.now - (this.lockMsgAt || 0) > 1500) {
      this.lockMsgAt = this.time.now;
      this.juice.floatText(this.portal.x, this.portal.y - 50, 'DEFEAT KING SLIME!', '#ffb3c1', 8);
    }
  }

  collectCoin(c) {
    if (!c.active) return;
    const now = this.time.now;
    this.coinCombo = now - this.lastCoinAt < 900 ? this.coinCombo + 1 : 0;
    this.lastCoinAt = now;
    c.disableBody(true, false);
    this.tweens.killTweensOf(c);
    this.tweens.add({ targets: c, y: c.y - 20, scale: 1.6, alpha: 0, duration: 260, ease: 'Cubic.Out', onComplete: () => c.destroy() });
    this.juice.sparkleBurst(c.x, c.y, 6);
    this.juice.sfx('coin', { volume: 0.45, rate: 1 + Math.min(this.coinCombo, 8) * 0.06 });
    this.run.coins++;
    this.gainXp(PROGRESSION.xpPerCoin);
    this.events.emit('hud');
  }

  gainXp(n) {
    this.run.xp += n;
    this.prog.xp += n;
    let need = PROGRESSION.xpPerLevel(this.prog.level);
    while (this.prog.xp >= need) {
      this.prog.xp -= need;
      this.prog.level++;
      need = PROGRESSION.xpPerLevel(this.prog.level);
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 1);
      this.juice.sfx('levelup', { volume: 0.5 });
      const t = this.add.text(this.player.x, this.player.y - 40, 'LEVEL UP!', {
        fontFamily: 'Lilita', fontSize: '26px', color: '#fff36b', stroke: '#7a2e00', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(70);
      this.tweens.add({ targets: t, y: t.y - 30, scale: { from: 0.4, to: 1.1 }, duration: 400, ease: 'Back.Out' });
      this.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 400, onComplete: () => t.destroy() });
      this.juice.sparkleBurst(this.player.x, this.player.y, 12);
      this.cameras.main.flash(150, 255, 255, 200);
    }
    this.registry.set('prog', this.prog);
    this.events.emit('hud');
  }

  update(time, delta) {
    const sx = this.cameras.main.scrollX;
    this.bg.forEach((b) => { b.tilePositionX = sx * b.factor + (b.factor === 0.08 ? time * 0.004 : 0); });

    if (this.completed) return;
    const p = this.player;
    p.update(time);
    if (p.grounded && p.body.blocked.down) {
      const below = this.layer.getTileAtWorldXY(p.x, p.body.bottom + 2);
      if (below && below.index < T.LL) this.lastSafe = { x: p.x, y: p.y - 4 };
    }
    const pr = this.bodyRect(p);

    // checkpoints
    for (const c of this.checkpoints) {
      if (!c.isActive && !p.dead && Phaser.Geom.Rectangle.Overlaps(c.zone, pr)) {
        c.activate();
        this.respawnPoint = { ...c.respawn };
        this.events.emit('hud');
      }
    }

    // sword vs slimes
    const hb = p.swordHitbox();
    for (const s of this.slimes) {
      if (s.dead) continue;
      s.update(time);
      if (s.y > this.worldH + 64) { s.dead = true; s.destroyAll(); continue; }
      if (hb && !p.hitThisSwing.has(s) && hits(hb, s.getBounds())) {
        p.hitThisSwing.add(s);
        this.hitSlime(s, time);
      }
      if (!s.dead && !p.dead && time > s.stunUntil && hits(pr, this.bodyRect(s))) this.hurtPlayer(ENEMY.slime.contactDamage, s.x, time, false, s.mini ? 'mini' : 'slime');
    }
    this.slimes = this.slimes.filter((s) => s.active);

    // boss fight
    if (this.boss) this.updateBoss(time, delta, hb, pr);

    // fell in a pit
    if (p.y > this.worldH + 40 && !p.dead) {
      this.hurtPlayer(1, p.x, time, true, 'pit');
      if (!p.dead) {
        p.setPosition(this.lastSafe.x, this.lastSafe.y);
        p.body.setVelocity(0, 0);
        this.cameras.main.flash(120, 255, 255, 255);
      }
    }

    this.drops.getChildren().forEach((d) => { if (!d.getData('ready') && time > d.getData('readyAt')) d.setData('ready', true); });
  }

  // ───────────── King Slime ─────────────
  updateBoss(time, delta, hb, pr) {
    const p = this.player, k = this.boss;
    if (this.fight === 'none' && !p.dead && p.x > this.gateX + 4 * TILE) this.startFight(time);
    if (this.fight !== 'active') return;
    k.update(time, p);
    if (!k.dead) {
      const kr = this.bodyRect(k);
      if (hb && !p.hitThisSwing.has(k) && hits(hb, kr)) { p.hitThisSwing.add(k); this.hitBoss(time); }
      if (!k.dead && !p.dead && k.state !== 'dizzy' && hits(pr, kr)) this.hurtPlayer(BOSS.contactDamage, k.x, time, false, 'boss-' + k.state);
    }
    // shockwaves roll along the ground: jump over them!
    const dt = delta / 1000;
    for (const s of this.shocks) {
      s.spr.x += s.dir * s.speed * dt;
      const r = new R(s.spr.x - 11, s.ground - 16, 22, 16);
      if (!p.dead && hits(pr, r)) this.hurtPlayer(BOSS.shockDamage, s.spr.x - s.dir * 10, time, false, 'shock');
      if (time > s.until || s.spr.x < this.gateX + 16 || s.spr.x > this.worldW - 8) { s.dead = true; s.spr.destroy(); }
      else if (Math.random() < 0.25) this.juice.puff(s.spr.x, s.ground - 4, 0.4);
    }
    this.shocks = this.shocks.filter((s) => !s.dead);
  }

  startFight(time) {
    this.fight = 'active';
    this.gate.setVisible(true); this.gate.body.enable = true;
    this.gate.setScale(1, 0);
    this.tweens.add({ targets: this.gate, scaleY: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: this.gate, alpha: { from: 0.9, to: 0.5 }, yoyo: true, repeat: -1, duration: 400 });
    this.juice.sparkleBurst(this.gate.x, this.groundTop - 40, 10);
    const cam = this.cameras.main;
    cam.setBounds(this.gateX, 0, this.worldW - this.gateX, this.worldH);
    this.boss.awaken(time);
    const m = this.sound.get('music'); if (m) this.tweens.add({ targets: m, rate: 1.12, duration: 800 });
  }

  bossIntroText() {
    const cam = this.cameras.main;
    const t = this.add.text(GAME_W / 2, 120, 'KING SLIME APPEARS!', {
      fontFamily: 'Lilita', fontSize: '30px', color: '#9ff2e6', stroke: '#173a4a', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90);
    this.tweens.add({ targets: t, scale: { from: 2, to: 1 }, duration: 350, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
    cam.flash(120, 200, 255, 250);
  }

  spawnShockwave(ground, x, dir, speed) {
    const spr = this.add.sprite(x + dir * 40, ground - 12, 'shock').play('shock').setDepth(16).setFlipX(dir < 0).setScale(1.2);
    this.shocks.push({ spr, dir, speed, ground, until: this.time.now + BOSS.slam.shockLifeMs });
  }

  spawnMini(x, y, vx) {
    const s = new Slime(this, x, y, this.layer, { mini: true });
    this.physics.add.collider(s, this.layer);
    this.physics.add.collider(s, this.gate);
    s.body.setVelocity(vx, -280);
    s.state = 'air';
    s.stunUntil = this.time.now + 350;
    this.juice.puff(x, y, 0.8);
    this.slimes.push(s);
  }

  hitBoss(time) {
    const k = this.boss;
    const crit = Math.random() < this.stats.critChance;
    const dmg = Math.round(this.stats.attack * Phaser.Math.FloatBetween(0.85, 1.2) * (crit ? 1.6 : 1) * (k.state === 'dizzy' ? 1.5 : 1));
    const r = k.damage(dmg);
    this.juice.damageNumber(k.x + Phaser.Math.Between(-10, 10), k.y - 50, dmg, crit ? 'purple' : 'orange', true);
    this.juice.flash(k);
    this.juice.hitStop(crit ? 80 : 50);
    this.juice.shake(crit ? [140, 0.01] : COMBAT.shakeHit);
    this.juice.sfx('hit', { volume: 0.65, rate: crit ? 0.8 : Phaser.Math.FloatBetween(0.85, 1) });
    this.juice.sparkleBurst(k.x, k.y, 5);
    // small push-back so you don't get body-checked right after hitting
    this.player.body.setVelocityX(this.player.x < k.x ? -140 : 140);
    this.events.emit('boss', { hp: k.hp });
    if (r.enragedNow) this.enrage();
    if (r.killed) this.killBoss();
  }

  enrage() {
    const k = this.boss;
    this.juice.sfx('roar', { volume: 0.7, rate: 0.85 });
    this.juice.shake([500, 0.014]);
    this.cameras.main.flash(200, 255, 90, 90);
    k.setTint(0xff7a7a);
    this.time.delayedCall(300, () => !k.dead && k.clearTint());
    const t = this.add.text(GAME_W / 2, 110, 'KING SLIME IS ENRAGED!', {
      fontFamily: 'Lilita', fontSize: '26px', color: '#ff8a8a', stroke: '#4a0d18', strokeThickness: 7,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90);
    this.tweens.add({ targets: t, scale: { from: 1.8, to: 1 }, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 400, onComplete: () => t.destroy() });
    this.events.emit('boss', { enraged: true });
    // brief breather, then faster attacks
    k.toIdle(this.time.now, 300);
  }

  killBoss() {
    const k = this.boss;
    this.fight = 'won';
    this.run.bossDefeated = true;
    this.shocks.forEach((s) => s.spr.destroy()); this.shocks = [];
    k.body.enable = false;
    k.play('king-hurt', true);
    this.juice.sfx('bossdie', { volume: 0.6 });
    this.cameras.main.flash(250, 255, 255, 255);
    this.juice.shake([900, 0.012]);
    // wobble + rapid puffs, then one huge pop
    this.tweens.add({ targets: k, angle: { from: -8, to: 8 }, yoyo: true, repeat: 6, duration: 70 });
    for (let i = 0; i < 9; i++) {
      this.time.delayedCall(i * 100, () => {
        this.juice.puff(k.x + Phaser.Math.Between(-45, 45), k.y + Phaser.Math.Between(-35, 30), Phaser.Math.FloatBetween(1, 1.8));
        this.juice.sfx('puff', { volume: 0.4, rate: 0.8 + i * 0.05 });
        this.juice.flash(k, i % 2 ? 0xffffff : 0xfff36b, 60);
      });
    }
    this.time.delayedCall(950, () => {
      const x = k.x, y = k.y;
      this.juice.puff(x, y, 4.5);
      this.juice.puff(x - 30, y + 10, 3); this.juice.puff(x + 30, y + 10, 3);
      this.juice.sfx('puff', { volume: 0.9, rate: 0.6 });
      this.juice.shake([300, 0.02]);
      this.tweens.add({ targets: k, scale: 0, alpha: 0, duration: 220, onComplete: () => k.setVisible(false) });
      // crown pops off and spins away
      const crown = this.add.image(x, y - 50, 'crown').setScale(3).setDepth(30);
      this.tweens.add({ targets: crown, y: y - 160, angle: 720, duration: 700, ease: 'Cubic.Out' });
      this.tweens.add({ targets: crown, alpha: 0, scale: 5, delay: 700, duration: 400, onComplete: () => crown.destroy() });
      // coin shower
      const n = Math.round(BOSS.coinShower * this.stats.luck);
      for (let i = 0; i < n; i++) {
        const c = this.drops.create(x, y - 10, 'coin').play({ key: 'coin-spin', startFrame: i % 6 }).setDepth(12);
        c.body.setSize(12, 12).setBounce(0.5).setDragX(90);
        c.setVelocity(Phaser.Math.Between(-260, 260), Phaser.Math.Between(-560, -300));
        c.setData('readyAt', this.time.now + 450);
      }
      // star burst
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const st = this.add.star(x, y, 5, 4, 9, 0xffd23b).setStrokeStyle(2, 0x7a2e00).setDepth(46);
        this.tweens.add({ targets: st, x: x + Math.cos(a) * 110, y: y + Math.sin(a) * 80, angle: 360, alpha: 0, scale: 0.4, duration: 900, ease: 'Cubic.Out', onComplete: () => st.destroy() });
      }
      this.juice.sparkleBurst(x, y, 16);
      this.juice.floatText(x, y - 70, `+${BOSS.xp} XP`, '#9dff7a', 12);
      this.gainXp(BOSS.xp);
      // the minis pop too
      this.slimes.filter((z) => z.mini && !z.dead).forEach((z, i) => this.time.delayedCall(80 * i, () => { if (!z.dead) { z.dead = true; this.killSlime(z); } }));
      const banner = this.add.text(GAME_W / 2, 110, 'KING SLIME DEFEATED!', {
        fontFamily: 'Lilita', fontSize: '32px', color: '#fff36b', stroke: '#7a2e00', strokeThickness: 8,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(90);
      this.tweens.add({ targets: banner, scale: { from: 2.2, to: 1 }, duration: 400, ease: 'Back.Out' });
      this.tweens.add({ targets: banner, alpha: 0, delay: 2200, duration: 500, onComplete: () => banner.destroy() });
      this.events.emit('boss', { hide: true, defeated: true });
    });
    this.time.delayedCall(1700, () => {
      this.lockPortal(false);
      this.juice.sfx('levelup', { volume: 0.5 });
      this.tweens.killTweensOf(this.gate);
      this.tweens.add({ targets: this.gate, scaleY: 0, alpha: 0, duration: 300, onComplete: () => { this.gate.setVisible(false); this.gate.body.enable = false; } });
      this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
      const m = this.sound.get('music'); if (m) this.tweens.add({ targets: m, rate: 1, duration: 800 });
    });
  }

  resetFight() {
    this.fight = 'none';
    this.boss.sleep();
    this.shocks.forEach((s) => s.spr.destroy()); this.shocks = [];
    this.slimes.filter((z) => z.mini && !z.dead).forEach((z) => { z.dead = true; z.destroyAll(); });
    this.tweens.killTweensOf(this.gate);
    this.gate.setVisible(false); this.gate.body.enable = false; this.gate.setAlpha(0.45);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.events.emit('boss', { hide: true });
    const m = this.sound.get('music'); if (m) m.setRate(1);
  }

  bodyRect(o) { const b = o.body; return new R(b.x, b.y, b.width, b.height); }

  hitSlime(s, time) {
    const crit = Math.random() < this.stats.critChance;
    const dmg = Math.round(this.stats.attack * Phaser.Math.FloatBetween(0.85, 1.2) * (crit ? 1.6 : 1));
    const killed = s.damage(dmg, this.player.x, time);
    this.juice.damageNumber(s.x, s.y - 26, dmg, crit ? 'purple' : 'orange', crit);
    this.juice.flash(s);
    this.juice.hitStop(crit ? COMBAT.hitStopMs * 1.6 : COMBAT.hitStopMs);
    this.juice.shake(crit ? [140, 0.01] : COMBAT.shakeHit);
    this.juice.sfx('hit', { volume: 0.6, rate: crit ? 0.85 : Phaser.Math.FloatBetween(1, 1.15) });
    this.juice.sparkleBurst(s.x, s.y, 4);
    if (killed) this.time.delayedCall(COMBAT.hitStopMs + 120, () => this.killSlime(s));
  }

  killSlime(s) {
    if (!s.active) return;
    const { x, y } = s;
    this.juice.puff(x, y, s.mini ? 1 : 1.4);
    this.juice.sfx('puff', { volume: 0.7 });
    if (!s.mini) this.run.kills++;
    this.juice.floatText(x, y - 40, `+${s.cfg.xp} XP`, '#9dff7a', 9);
    this.gainXp(s.cfg.xp);
    const n = Math.round(s.cfg.coinDrops * this.stats.luck);
    for (let i = 0; i < n; i++) {
      const c = this.drops.create(x, y - 6, 'coin').play('coin-spin').setDepth(12);
      c.body.setSize(12, 12).setBounce(0.45).setDragX(120);
      c.setVelocity(Phaser.Math.Between(-90, 90), Phaser.Math.Between(-320, -240));
      c.setData('readyAt', this.time.now + 350);
    }
    s.destroyAll();
  }

  hurtPlayer(amount, fromX, time, force = false, src = 'other') {
    const p = this.player;
    if (p.dead) return;
    if (force) p.invulnUntil = 0;
    if (!p.hurt(amount, fromX, time)) return;
    this.run.hpLost += Math.min(amount, this.stats.maxHp);
    this.run.hurtBy = this.run.hurtBy || {};
    this.run.hurtBy[src] = (this.run.hurtBy[src] || 0) + 1;
    this.juice.damageNumber(p.x, p.y - 34, Math.min(amount, 99), 'purple');
    this.juice.shake(COMBAT.shakeHurt);
    this.juice.hitStop(90);
    this.juice.sfx('hurt', { volume: 0.5 });
    this.cameras.main.flash(90, 255, 80, 80);
    this.events.emit('hud');
    if (p.dead) this.die();
  }

  /** Hearts hit 0: KO animation, then respawn at the last checkpoint with full hearts. */
  die() {
    const p = this.player;
    this.run.deaths++;
    p.body.setVelocity(0, -320); p.body.checkCollision.none = true;
    this.tweens.add({ targets: p, angle: 360, duration: 900 });
    const cam = this.cameras.main;
    const t = this.add.text(GAME_W / 2, GAME_H / 2 - 20, 'K.O.!', {
      fontFamily: 'Lilita', fontSize: '44px', color: '#ffffff', stroke: '#5a1e00', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(95).setScrollFactor(0);
    const t2 = this.add.text(GAME_W / 2, GAME_H / 2 + 20, 'back to your checkpoint...', {
      fontFamily: 'PressStart', fontSize: '8px', color: '#ffffff', stroke: '#1d2b53', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(95).setScrollFactor(0);
    this.tweens.add({ targets: t, scale: { from: 2, to: 1 }, duration: 300, ease: 'Back.Out' });
    this.time.delayedCall(CHECKPOINT.deathDelayMs, () => cam.fadeOut(250, 0, 0, 0));
    this.time.delayedCall(CHECKPOINT.deathDelayMs + 280, () => { t.destroy(); t2.destroy(); this.respawn(); });
  }

  respawn() {
    const p = this.player, r = this.respawnPoint;
    if (this.fight === 'active') this.resetFight();
    this.tweens.killTweensOf(p);
    p.setAngle(0).setScale(1).setAlpha(1);
    p.body.checkCollision.none = false;
    p.setPosition(r.x, r.y);
    p.body.setVelocity(0, 0);
    p.hp = this.stats.maxHp;
    p.dead = false; p.attacking = false; p.hurtLockUntil = 0;
    p.invulnUntil = this.time.now + CHECKPOINT.respawnInvulnMs;
    touch.jumpTap = touch.attackTap = false;
    this.lastSafe = { ...r };
    const cam = this.cameras.main;
    cam.centerOn(r.x, r.y);
    cam.fadeIn(300, 0, 0, 0);
    this.juice.sparkleBurst(r.x, r.y, 12);
    this.juice.sfx('checkpoint', { volume: 0.35, rate: 1.2 });
    this.events.emit('hud', { respawn: true });
  }

  finish() {
    if (this.completed) return;
    this.completed = true;
    const p = this.player;
    p.frozen = true;
    p.body.setVelocity(0, 0); p.body.setAllowGravity(false);
    this.juice.sfx('levelup', { volume: 0.6 });
    this.tweens.add({ targets: p, x: this.portal.x, y: this.portal.y, scale: 0.1, angle: 540, alpha: 0.2, duration: 700, ease: 'Cubic.In' });
    this.juice.sparkleBurst(this.portal.x, this.portal.y, 14);
    const timeSec = (this.time.now - this.run.startedAt) / 1000;
    this.time.delayedCall(800, () => {
      this.cameras.main.fadeOut(250, 255, 255, 255);
      this.time.delayedCall(260, () => {
        this.scene.stop('HUD'); this.scene.stop('Touch');
        this.scene.start('LevelComplete', {
          ...this.run, timeSec, totalCoins: this.totalCoins, totalSlimes: this.totalSlimes,
          prog: this.prog, levelName: this.level.name,
        });
      });
    });
  }
}
