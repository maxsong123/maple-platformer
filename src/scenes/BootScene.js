import Phaser from 'phaser';

const SFX = ['coin', 'jump', 'swing', 'hit', 'hurt', 'puff', 'select', 'levelup', 'star', 'music', 'checkpoint', 'slam', 'roar', 'warn', 'bossdie'];

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 100, height / 2, 0, 10, 0xffe066).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2, 204, 14).setStrokeStyle(2, 0xffffff);
    this.load.on('progress', (p) => { bar.width = 200 * p; });

    this.load.setPath('assets/');
    this.load.spritesheet('hero', 'hero.png', { frameWidth: 64, frameHeight: 56 });
    this.load.spritesheet('slime', 'slime.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('coin', 'coin.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('portal', 'portal.png', { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('sparkle', 'sparkle.png', { frameWidth: 9, frameHeight: 9 });
    this.load.spritesheet('puff', 'puff.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('slash', 'slash.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('heart', 'heart.png', { frameWidth: 11, frameHeight: 10 });
    this.load.spritesheet('digits', 'digits.png', { frameWidth: 22, frameHeight: 30 });
    this.load.spritesheet('kingslime', 'kingslime.png', { frameWidth: 40, frameHeight: 40 });
    this.load.spritesheet('flag', 'flag.png', { frameWidth: 24, frameHeight: 48 });
    this.load.spritesheet('shock', 'shock.png', { frameWidth: 32, frameHeight: 24 });
    this.load.image('crown', 'crown.png');
    this.load.image('tiles', 'tiles.png');
    this.load.spritesheet('tileset', 'tiles.png', { frameWidth: 32, frameHeight: 32 });
    ['bg_sky', 'bg_clouds', 'bg_far', 'bg_near'].forEach((k) => this.load.image(k, `${k}.png`));
    SFX.forEach((k) => this.load.audio(k, [`sfx/${k}.ogg`, `sfx/${k}.mp3`]));
  }

  create() {
    const a = (key, frames, frameRate, repeat = -1) =>
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(frames[0], { frames: frames[1] }), frameRate, repeat });
    a('hero-idle', ['hero', [0, 1]], 3);
    a('hero-walk', ['hero', [2, 3, 4, 5]], 9);
    a('hero-jump', ['hero', [6]], 1);
    a('hero-attack', ['hero', [7, 8, 9]], 18, 0);
    a('hero-hurt', ['hero', [10]], 1);
    a('slime-idle', ['slime', [0, 1]], 3);
    a('slime-crouch', ['slime', [2]], 1, 0);
    a('slime-air', ['slime', [3]], 1, 0);
    a('slime-hurt', ['slime', [4]], 1, 0);
    a('king-idle', ['kingslime', [0, 1]], 3);
    a('king-angry', ['kingslime', [5, 1]], 5);
    a('king-crouch', ['kingslime', [2]], 1, 0);
    a('king-crouch-angry', ['kingslime', [6]], 1, 0);
    a('king-air', ['kingslime', [3]], 1, 0);
    a('king-hurt', ['kingslime', [4]], 1, 0);
    a('flag-raise', ['flag', [1, 2, 3]], 12, 0);
    a('flag-wave', ['flag', [3, 4, 5, 6]], 8);
    a('shock', ['shock', [0, 1, 2, 1]], 14);
    a('coin-spin', ['coin', [0, 1, 2, 3, 4, 5]], 10);
    a('portal-swirl', ['portal', [0, 1, 2, 3, 4, 5]], 10);
    a('sparkle', ['sparkle', [0, 1, 2, 3]], 14, 0);
    a('puff', ['puff', [0, 1, 2, 3, 4, 5]], 18, 0);
    a('slash', ['slash', [0, 1, 2]], 24, 0);

    const skip = new URLSearchParams(location.search).has('play');
    this.scene.start(skip ? 'Game' : 'Title');
  }
}
