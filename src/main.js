import Phaser from 'phaser';
import { GAME_W, GAME_H, PHYS } from './config/tuning.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';
import LevelCompleteScene from './scenes/LevelCompleteScene.js';
import TouchScene from './scenes/TouchScene.js';

// phones: block page scroll / pinch-zoom / double-tap zoom / long-press menus while playing
const stop = (e) => { if (e.cancelable) e.preventDefault(); };
['touchmove', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu'].forEach((ev) =>
  document.addEventListener(ev, stop, { passive: false }));
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTouchEnd < 300) stop(e); lastTouchEnd = n; }, { passive: false });

const start = () => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#58aaff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: PHYS.gravity }, debug: false } },
    input: { activePointers: 4 },
    scene: [BootScene, TitleScene, GameScene, HUDScene, LevelCompleteScene, TouchScene],
  });
  window.__game = game; // handy for debugging / automated tests
};

// make sure the pixel fonts are ready before Phaser renders text
Promise.all([
  document.fonts.load('16px PressStart'),
  document.fonts.load('16px Lilita'),
]).catch(() => {}).finally(start);
