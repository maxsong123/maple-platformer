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
    this.load.atlas('hero', 'hero.png', 'hero.json');
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
    const an = (key, prefix, start, end, frameRate, repeat = -1) =>
      this.anims.create({ key, frames: this.anims.generateFrameNames('hero', { prefix, start, end }), frameRate, repeat });
    an('hero-idle', 'hero-idle-', 0, 1, 3);
    an('hero-walk', 'hero-walk-', 0, 7, 12);
    an('hero-jump', 'hero-jump-', 0, 0, 1);
    an('hero-attack', 'hero-attack-', 0, 2, 18, 0);
    an('hero-hurt', 'hero-hurt-', 0, 0, 1);
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

    this.makeItemTextures();

    const skip = new URLSearchParams(location.search).has('play');
    this.scene.start(skip ? 'Game' : 'Title');
  }

  /** Procedurally draw item/projectile sprites so the game stays asset-toolchain-free. */
  makeItemTextures() {
    const mk = (key, w, h, draw) => {
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    const flask = (key, liquid, shine) => mk(key, 14, 18, (g) => {
      g.fillStyle(0x5a3a1e, 1); g.fillRect(5, 0, 4, 3);              // cork
      g.fillStyle(0x1d2b53, 1); g.fillRect(4, 3, 6, 4);             // neck outline
      g.fillStyle(0xeaf6ff, 1); g.fillRect(5, 4, 4, 2);             // neck glass
      g.fillStyle(0x1d2b53, 1); g.fillRoundedRect(1, 6, 12, 11, 4); // body outline
      g.fillStyle(liquid, 1);   g.fillRoundedRect(2, 7, 10, 9, 3);  // liquid
      g.fillStyle(shine, 0.9);  g.fillRect(3, 8, 2, 4);             // shine streak
      g.fillStyle(0xffffff, 0.6); g.fillRect(9, 12, 1, 2);          // speck
    });
    flask('potion', 0xff3b5c, 0xffd1dc);
    flask('elixir', 0x3bc6ff, 0xd6f3ff);
    mk('star_item', 16, 16, (g) => {
      const c = 8;
      const ring = (sc, color) => {
        const pts = [[c, 0], [c + 2.4, c - 2.4], [16, c], [c + 2.4, c + 2.4], [c, 16], [c - 2.4, c + 2.4], [0, c], [c - 2.4, c - 2.4]]
          .map(([x, y]) => ({ x: c + (x - c) * sc, y: c + (y - c) * sc }));
        g.fillStyle(color, 1); g.fillPoints(pts, true);
      };
      ring(1, 0x1d2b53);      // navy outline
      ring(0.82, 0xcfe8ff);   // steel body
      g.fillStyle(0x1d2b53, 1); g.fillCircle(c, c, 1.6); // center hole
    });
  }
}
