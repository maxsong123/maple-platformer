import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config/tuning.js';
import { isTouchDevice } from '../objects/TouchState.js';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.layers = ['bg_sky', 'bg_clouds', 'bg_far', 'bg_near'].map((k, i) =>
      this.add.tileSprite(0, i === 3 ? 10 : 0, GAME_W, GAME_H, k).setOrigin(0));
    // ground strip
    for (let x = 0; x < GAME_W; x += 32) {
      this.add.image(x, GAME_H - 64, 'tileset', 1).setOrigin(0);
      this.add.image(x, GAME_H - 32, 'tileset', 4).setOrigin(0);
    }
    const hero = this.add.sprite(GAME_W / 2 - 60, GAME_H - 64 - 26, 'hero').play('hero-idle').setScale(2).setOrigin(0.5, 0.5);
    hero.y = GAME_H - 64 - 52;
    const slime = this.add.sprite(GAME_W / 2 + 80, GAME_H - 64 - 30, 'slime').play('slime-idle').setScale(2);
    this.tweens.add({ targets: slime, y: slime.y - 26, yoyo: true, repeat: -1, duration: 420, ease: 'Quad.Out', repeatDelay: 500 });

    const title = this.add.text(GAME_W / 2, 78, "MAX'S\nMAPLE QUEST", {
      fontFamily: 'Lilita', fontSize: '46px', align: 'center', color: '#fff36b', stroke: '#7a2e00', strokeThickness: 10,
      lineSpacing: -8, shadow: { offsetX: 0, offsetY: 5, color: '#00000055', blur: 0, fill: true, stroke: true },
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: 84, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.InOut' });

    const touchDev = isTouchDevice();
    const press = this.add.text(GAME_W / 2, 170, touchDev ? 'TAP TO START' : 'PRESS SPACE TO START', {
      fontFamily: 'PressStart', fontSize: '10px', color: '#ffffff', stroke: '#1d2b53', strokeThickness: 5,
    }).setOrigin(0.5);
    this.tweens.add({ targets: press, alpha: 0.25, yoyo: true, repeat: -1, duration: 550 });
    this.add.text(GAME_W / 2, 194, touchDev ? 'left stick to move    JUMP    ATK' : 'ARROWS/WASD move   SPACE jump   X/J attack', {
      fontFamily: 'PressStart', fontSize: '7px', color: '#1d2b53',
    }).setOrigin(0.5);

    const go = () => {
      if (this.starting) return; this.starting = true;
      // first tap/keypress = user gesture: unlock Web Audio (needed on iOS/Android)
      try { if (this.sound.context && this.sound.context.state !== 'running') this.sound.context.resume(); this.sound.unlock && this.sound.unlock(); } catch (e) { /* ignore */ }
      this.sound.play('select', { volume: 0.5 });
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(320, () => this.scene.start('Game'));
    };
    this.input.keyboard.once('keydown-SPACE', go);
    this.input.keyboard.once('keydown-ENTER', go);
    this.input.once('pointerdown', go);
  }

  update(t) {
    this.layers[1].tilePositionX = t * 0.01;
    this.layers[2].tilePositionX = t * 0.015;
    this.layers[3].tilePositionX = t * 0.03;
  }
}
