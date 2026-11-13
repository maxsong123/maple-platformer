import { STARTING_INV } from '../config/items.js';

/** Dead-simple bag of item counts. Keys match ITEMS in config/items.js. */
export default class Inventory {
  constructor(initial = STARTING_INV) { this.slots = { ...initial }; }
  count(type) { return this.slots[type] || 0; }
  add(type, n = 1) { this.slots[type] = this.count(type) + n; return this.slots[type]; }
  /** take `n` if available; returns true on success. */
  take(type, n = 1) { if (this.count(type) < n) return false; this.slots[type] -= n; return true; }
}
