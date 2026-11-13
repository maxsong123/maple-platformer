// Items, inventory, and ranged-weapon tuning.
// Items are either `usable` (press/tap to consume for an effect) or ammo (thrown).
// Textures for the icons are generated in BootScene.makeItemTextures().
export const ITEMS = {
  potion: { name: 'Potion', icon: 'potion', usable: true, heal: 2, hotkey: '1' },
  elixir: { name: 'Elixir', icon: 'elixir', usable: true, heal: 99, hotkey: '2' }, // full heal (clamped to maxHp)
  star:   { name: 'Star',   icon: 'star_item', usable: false, pickup: 3, hotkey: 'F' }, // thrown ammo
};

// Order items appear in the HUD inventory bar.
export const INV_ORDER = ['potion', 'elixir', 'star'];

// What the hero starts each run with.
export const STARTING_INV = { potion: 1, elixir: 0, star: 5 };

// Throwing-star ranged weapon. Damage is stats.attack * dmgMult (crits still apply).
export const RANGED = { dmgMult: 0.75, speed: 540, lifeMs: 850, cooldownMs: 260 };
