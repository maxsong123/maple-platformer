/** Shared, scene-independent touch state (written by TouchScene, read by Controls). */

/** Layout in game pixels (640x360). Tests and the Touch scene share these numbers. */
export const TOUCH_UI = {
  stick: { x: 96, y: 288, baseR: 42, knobR: 18, maxR: 34, dead: 0.28 },
  jump: { x: 582, y: 262, r: 38, hitR: 56 },
  attack: { x: 498, y: 300, r: 32, hitR: 48 },
  leftZone: 0.45, // fraction of GAME_W that can grab the stick
};

export const touch = {
  enabled: false,
  left: false, right: false, jump: false, attack: false, ranged: false,
  jumpTap: false, attackTap: false, rangedTap: false,   // latched on pointerdown so very quick taps never get lost
  axisX: 0,                           // -1..1, already dead-zoned (0 inside the dead zone)
  axisY: 0,                           // recorded but never used for jump
};

export function isTouchDevice() {
  const q = new URLSearchParams(location.search);
  if (q.has('touch')) return true;
  if (q.has('notouch')) return false;
  return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

export function resetTouch() {
  touch.left = touch.right = touch.jump = touch.attack = touch.ranged = false;
  touch.jumpTap = touch.attackTap = touch.rangedTap = false;
  touch.axisX = 0;
  touch.axisY = 0;
}
