import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config/tuning.js';
import { isTouchDevice } from '../objects/TouchState.js';

export default class LevelCompleteScene extends Phaser.Scene {
  constructor() { super('LevelComplete'); }

  create(d) {
    this.cameras.main.fadeIn(300, 255, 255, 255);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'bg_sky').setOrigin(0);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'bg_clouds').setOrigin(0);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, 'bg_far').setOrigin(0);

    // rotating rays behind the panel
    const rays = this.add.graphics({ x: GAME_W / 2, y: 120 });
    rays.fillStyle(0xfff6b0, 0.35);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays.fillTriangle(0, 0, Math.cos(a) * 420, Math.sin(a) * 420, Math.cos(a + 0.18) * 420, Math.sin(a + 0.18) * 420);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 20000, repeat: -1 });

    const panel = this.add.rectangle(GAME_W / 2, 200, 360, 200, 0x1d2b53, 0.88).setStrokeStyle(3, 0xffe066);
    this.add.text(GAME_W / 2, 48, 'STAGE CLEAR!', {
      fontFamily: 'Lilita', fontSize: '40px', color: '#fff36b', stroke: '#7a2e00', strokeThickness: 9,
    }).setOrigin(0.5);

    // stars: 1 = finished, 2 = 75%+ of placed coins, 3 = every slime defeated
    const earned = 1 + (d.coins >= d.totalCoins * 0.75 ? 1 : 0) + (d.kills >= d.totalSlimes ? 1 : 0);
    for (let i = 0; i < 3; i++) {
      const sx = GAME_W / 2 + (i - 1) * 56;
      const star = this.add.star(sx, 128, 5, 10, 22, 0x3a4a75).setStrokeStyle(3, 0x0e1530);
      if (i < earned) {
        this.time.delayedCall(450 + i * 380, () => {
          star.setFillStyle(0xffd23b).setStrokeStyle(3, 0x7a2e00);
          star.setScale(2.2);
          this.tweens.add({ targets: star, scale: 1, angle: 72, duration: 300, ease: 'Back.Out' });
          this.sound.play('star', { volume: 0.5, rate: 1 + i * 0.12 });
          this.cameras.main.shake(80, 0.004);
          for (let k = 0; k < 8; k++) {
            const sp = this.add.sprite(sx, 128, 'sparkle').play('sparkle').setScale(1.5);
            const a = (k / 8) * Math.PI * 2;
            this.tweens.add({ targets: sp, x: sx + Math.cos(a) * 34, y: 128 + Math.sin(a) * 34, alpha: 0, duration: 450, onComplete: () => sp.destroy() });
          }
        });
      }
    }

    this.add.text(GAME_W / 2, 150, 'clear  ·  75% coins  ·  all slimes', { fontFamily: 'PressStart', fontSize: '6px', color: '#a9c1ff' }).setOrigin(0.5);
    const line = (y, label, value, color = '#ffffff') => {
      this.add.text(GAME_W / 2 - 150, y, label, { fontFamily: 'PressStart', fontSize: '9px', color: '#a9c1ff' });
      return this.add.text(GAME_W / 2 + 150, y, value, { fontFamily: 'PressStart', fontSize: '9px', color }).setOrigin(1, 0);
    };
    const coinT = line(164, 'COINS', `0 / ${d.totalCoins}`, '#ffe066');
    line(179, 'SLIMES', `${d.kills} / ${d.totalSlimes}`);
    line(194, 'KING SLIME', d.bossDefeated ? 'DEFEATED!' : '-', '#9ff2e6');
    line(209, 'TIME', `${d.timeSec.toFixed(1)}s   K.O. x${d.deaths || 0}`);
    const xpT = line(224, 'XP GAINED', '+0', '#9dff7a');
    line(239, 'HERO LEVEL', `Lv.${d.prog.level}`, '#ffe066');

    // count-up
    const counter = { c: 0, x: 0 };
    this.tweens.add({
      targets: counter, c: d.coins, x: d.xp, duration: 1200, delay: 300, ease: 'Cubic.Out',
      onUpdate: () => {
        coinT.setText(`${Math.round(counter.c)} / ${d.totalCoins}`);
        xpT.setText(`+${Math.round(counter.x)}`);
      },
    });

    const again = this.add.text(GAME_W / 2, 280, isTouchDevice() ? 'TAP TO PLAY AGAIN' : 'SPACE: PLAY AGAIN', {
      fontFamily: 'PressStart', fontSize: '10px', color: '#ffffff', stroke: '#1d2b53', strokeThickness: 5,
    }).setOrigin(0.5);
    this.tweens.add({ targets: again, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });
    this.time.delayedCall(800, () => {
      const playAgain = () => { if (this.leaving) return; this.leaving = true; this.scene.start('Game'); };
      this.input.keyboard.once('keydown-SPACE', playAgain);
      this.input.keyboard.once('keydown-ENTER', playAgain);
      this.input.once('pointerdown', playAgain);
    });
    window.__levelComplete = d;
  }
}
