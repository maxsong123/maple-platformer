// Feel/juice knobs. Tweak freely.
export const GAME_W = 640;
export const GAME_H = 360;
export const TILE = 32;

export const PHYS = {
  gravity: 1500,
  accelGround: 1900,
  accelAir: 1300,
  dragGround: 2200,
  maxFall: 720,
  coyoteMs: 100,
  jumpBufferMs: 120,
  jumpCutMultiplier: 0.45, // releasing jump early cuts upward speed (variable height)
};

export const COMBAT = {
  attackCooldownMs: 300,
  attackActiveFrames: [8, 9],  // hero sheet frames where the sword hurts
  attackReach: 34,
  hitStopMs: 70,
  shakeHit: [90, 0.006],
  shakeHurt: [160, 0.012],
  invulnMs: 1100,
  knockback: { x: 260, y: -240 },
  enemyKnockback: { x: 220, y: -200 },
};

export const ENEMY = {
  slime: { hp: 26, speed: 40, hopEveryMs: [1400, 2600], hopVy: -300, xp: 15, coinDrops: 2, contactDamage: 1 },
};

export const PROGRESSION = {
  xpPerCoin: 1,
  xpPerLevel: (lvl) => 40 + lvl * 20,
};

// King Slime mini-boss. All times in ms, speeds in px/s. "enraged" values kick in at 50% HP.
export const BOSS = {
  name: 'KING SLIME',
  hp: 280,
  scale: 3,
  walkSpeed: 55,
  restMs: [900, 1500],        // pause between attacks
  restMsEnraged: [500, 900],
  telegraphMs: 750,           // wind-up before every attack (shake/flash/"!")
  telegraphMsEnraged: 480,
  slam: { airMs: 900, shockSpeed: 260, shockSpeedEnraged: 330, shockLifeMs: 1800 },
  summon: { count: 2, countEnraged: 3, maxMinis: 3 },
  charge: { speed: 360, speedEnraged: 450, maxMs: 1500, stunMs: 900 },
  contactDamage: 1,
  shockDamage: 1,
  xp: 150,
  coinShower: 24,
  mini: { hp: 14, xp: 5, coinDrops: 1, scale: 0.8 },
};

export const CHECKPOINT = { respawnInvulnMs: 1600, deathDelayMs: 1400 };
