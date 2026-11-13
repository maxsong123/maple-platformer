// ─────────────────────────────────────────────────────────────
// PLAYER STATS: the single place gameplay reads hero power from.
// Later, the habit tracker will feed these (e.g. health habits -> maxHp,
// work with Peter -> attack, friends -> speed/jump, relationships -> luck).
// For now: base values, optionally overridden via localStorage 'mpq.stats'
// (JSON) or the URL, e.g.  ?stats={"attack":20,"maxHp":7}
// ─────────────────────────────────────────────────────────────
export const BASE_STATS = {
  maxHp: 5,          // hearts
  attack: 12,        // base sword damage (Maple-style numbers float up)
  critChance: 0.15,  // chance of a crit (x1.6, purple numbers)
  speed: 175,        // run speed px/s
  jump: 560,         // jump impulse px/s (~3.5 tiles)
  maxJumps: 2,       // jumps before touching ground again (2 = double jump)
  luck: 1.0,         // coin-drop multiplier from slimes
};

function readOverrides() {
  const out = {};
  try { Object.assign(out, JSON.parse(localStorage.getItem('mpq.stats') || '{}')); } catch (e) { /* ignore */ }
  try {
    const q = new URLSearchParams(location.search).get('stats');
    if (q) Object.assign(out, JSON.parse(q));
  } catch (e) { /* ignore */ }
  return out;
}

/** Returns the hero's current stats. Swap this out for the habit-tracker feed later. */
export function getPlayerStats() {
  return { ...BASE_STATS, ...readOverrides() };
}
