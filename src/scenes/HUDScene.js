import Phaser from 'phaser';
import { GAME_W, PROGRESSION, BOSS } from '../config/tuning.js';
import { ITEMS, INV_ORDER } from '../config/items.js';
import { isTouchDevice } from '../objects/TouchState.js';

/** Overlay HUD: hearts, coin count, level + XP bar, boss HP bar, mute button. */
export default class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  create({ game }) {
    this.g = game;
    const txt = (x, y, s, size = 8, color = '#ffffff') => this.add.text(x, y, s, {
      fontFamily: 'PressStart', fontSize: `${size}px`, color, stroke: '#1d2b53', strokeThickness: 4,
    });

    this.hearts = [];
    for (let i = 0; i < game.stats.maxHp; i++) this.hearts.push(this.add.image(12 + i * 14, 12, 'heart', 0).setOrigin(0).setScale(1.2));

    // ── inventory bar (second row, under the hearts). Tap a potion/elixir to use it.
    this.lastInv = {};
    this.invSlots = INV_ORDER.map((type, i) => {
      const x = 10 + i * 46, y = 30;
      const box = this.add.rectangle(x, y, 42, 20, 0x1d2b53, 0.55).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.35);
      const icon = this.add.image(x + 11, y + 10, ITEMS[type].icon);
      const count = txt(x + 21, y + 6, 'x0', 8);
      txt(x + 2, y + 1, ITEMS[type].hotkey, 6, '#ffe066');
      if (ITEMS[type].usable) {
        box.setInteractive({ useHandCursor: true }).on('pointerdown', () => game.useItem(type));
      }
      return { type, icon, count, box };
    });

    this.coinIcon = this.add.sprite(GAME_W - 86, 18, 'coin').play('coin-spin');
    this.coinText = txt(GAME_W - 74, 11, '0', 10, '#ffe066');

    const y = 346;
    this.add.rectangle(0, y - 6, GAME_W, 20, 0x1d2b53, 0.75).setOrigin(0);
    this.lvText = txt(8, y - 2, 'Lv.1', 8, '#ffe066');
    this.add.rectangle(64, y + 2, GAME_W - 140, 8, 0x0e1530).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff, 0.8);
    this.xpFill = this.add.rectangle(65, y + 2, 0, 6, 0xf7d23b).setOrigin(0, 0.5);
    this.xpShine = this.add.rectangle(65, y, 0, 2, 0xfff6b0).setOrigin(0, 0.5);
    this.xpText = txt(GAME_W - 70, y - 2, '0%', 8);
    const touchDev = isTouchDevice();
    this.hint = txt(12, 54, touchDev ? 'Left stick moves | JUMP x2 | ATK | THROW star | tap potion to heal' : 'WASD move  SPACE double-jump  X attack  F throw star  1/2 heal  M mute', 6, '#ffffffcc');
    this.time.delayedCall(7000, () => this.tweens.add({ targets: this.hint, alpha: 0, duration: 600 }));

    // tap-friendly mute toggle (top-right, under the coin counter)
    this.muteBtn = txt(GAME_W - 40, 30, this.registry.get('muted') ? 'SND:OFF' : 'SND:ON', 6, '#ffffffaa').setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.input.hitArea.setTo(-14, -10, this.muteBtn.width + 28, this.muteBtn.height + 20);
    this.muteBtn.on('pointerdown', () => { const m = game.toggleMute(); this.muteBtn.setText(m ? 'SND:OFF' : 'SND:ON'); });
    game.input.keyboard.on('keydown-M', () => this.time.delayedCall(0, () => this.muteBtn.setText(this.registry.get('muted') ? 'SND:OFF' : 'SND:ON')));

    this.makeBossBar();

    this.shownXp = 0;
    this.lastHp = game.player.hp;
    this.lastCoins = 0;
    game.events.on('hud', this.refresh, this);
    game.events.on('boss', this.onBoss, this);
    this.events.once('shutdown', () => { game.events.off('hud', this.refresh, this); game.events.off('boss', this.onBoss, this); });
    this.refresh();
  }

  makeBossBar() {
    const W = 300, x = GAME_W / 2, y = 22;
    const c = this.add.container(x, y).setAlpha(0).setVisible(false);
    const frame = this.add.rectangle(0, 8, W + 8, 16, 0x0e1530, 0.9).setStrokeStyle(2, 0xffe066);
    this.bossTrail = this.add.rectangle(-W / 2, 8, W, 10, 0xffffff).setOrigin(0, 0.5);
    this.bossFill = this.add.rectangle(-W / 2, 8, W, 10, 0x4fc6c0).setOrigin(0, 0.5);
    this.bossShine = this.add.rectangle(-W / 2, 5, W, 3, 0x9ff2e6).setOrigin(0, 0.5);
    const crown = this.add.image(-W / 2 - 4, -6, 'crown').setScale(1.4);
    this.bossName = this.add.text(-W / 2 + 10, -12, BOSS.name, { fontFamily: 'PressStart', fontSize: '8px', color: '#fff36b', stroke: '#1d2b53', strokeThickness: 4 });
    this.bossHpText = this.add.text(W / 2, -12, '', { fontFamily: 'PressStart', fontSize: '7px', color: '#ffffff', stroke: '#1d2b53', strokeThickness: 4 }).setOrigin(1, 0);
    c.add([frame, this.bossTrail, this.bossFill, this.bossShine, crown, this.bossName, this.bossHpText]);
    this.bossBar = c; this.bossW = W; this.trailW = W;
  }

  onBoss(e = {}) {
    if (e.show) {
      this.bossBar.setVisible(true);
      this.bossFill.setFillStyle(0x4fc6c0); this.bossShine.setFillStyle(0x9ff2e6);
      this.bossName.setText(BOSS.name);
      this.trailW = this.bossW;
      this.tweens.add({ targets: this.bossBar, alpha: 1, y: { from: 0, to: 22 }, duration: 350, ease: 'Back.Out' });
    }
    if (e.enraged) {
      this.bossFill.setFillStyle(0xff4d4d); this.bossShine.setFillStyle(0xffb0b0);
      this.bossName.setText(BOSS.name + ' (ENRAGED)');
      this.tweens.add({ targets: this.bossBar, scale: { from: 1.15, to: 1 }, duration: 300 });
    }
    if (e.hp !== undefined) this.tweens.add({ targets: this.bossBar, x: { from: GAME_W / 2 + 3, to: GAME_W / 2 }, duration: 80 });
    if (e.hide) this.tweens.add({ targets: this.bossBar, alpha: 0, duration: e.defeated ? 900 : 200, onComplete: () => this.bossBar.setVisible(false) });
  }

  update() {
    const b = this.g && this.g.boss;
    if (!b || !this.bossBar.visible) return;
    const w = this.bossW * Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
    this.bossFill.width = w; this.bossShine.width = w;
    // white "damage trail" catches up slowly
    this.trailW = Math.max(w, this.trailW - 2.2);
    this.bossTrail.width = this.trailW;
    this.bossHpText.setText(`${Math.ceil(b.hp)}/${b.maxHp}`);
  }

  refresh() {
    const g = this.g; if (!g || !g.player) return;
    const hp = g.player.hp;
    this.hearts.forEach((h, i) => h.setFrame(i < hp ? 0 : 1));
    if (hp < this.lastHp && this.hearts[hp]) {
      this.tweens.add({ targets: this.hearts[hp], scale: { from: 2, to: 1.2 }, duration: 250, ease: 'Back.Out' });
    }
    if (hp > this.lastHp) this.hearts.forEach((h, i) => this.tweens.add({ targets: h, scale: { from: 1.8, to: 1.2 }, delay: i * 50, duration: 220, ease: 'Back.Out' }));
    this.lastHp = hp;
    if (g.run.coins !== this.lastCoins) {
      this.coinText.setText(String(g.run.coins));
      this.tweens.add({ targets: [this.coinText, this.coinIcon], scale: { from: 1.5, to: 1 }, duration: 180, ease: 'Back.Out' });
      this.lastCoins = g.run.coins;
    }
    this.invSlots.forEach((s) => {
      const n = g.inv.count(s.type);
      if (this.lastInv[s.type] !== undefined && n !== this.lastInv[s.type]) {
        this.tweens.add({ targets: s.icon, scale: { from: 1.7, to: 1 }, duration: 220, ease: 'Back.Out' });
      }
      this.lastInv[s.type] = n;
      s.count.setText('x' + n);
      const empty = n <= 0;
      s.icon.setAlpha(empty ? 0.3 : 1);
      s.count.setColor(empty ? '#7a86a8' : '#ffffff');
    });

    const need = PROGRESSION.xpPerLevel(g.prog.level);
    const pct = Phaser.Math.Clamp(g.prog.xp / need, 0, 1);
    this.lvText.setText(`Lv.${g.prog.level}`);
    this.xpText.setText(`${Math.floor(pct * 100)}%`);
    const w = (GAME_W - 142) * pct;
    this.tweens.add({ targets: [this.xpFill, this.xpShine], width: w, duration: 250, ease: 'Cubic.Out' });
  }
}
