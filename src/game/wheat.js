import { WHEAT_1 } from '../data/blocks.js';

const STAGE_MS = 3 * 60 * 1000;
const isWheat = (id) => id >= WHEAT_1 && id <= WHEAT_1 + 2;
const key = (x, y, z) => `${x},${y},${z}`;

// Wheat advances a stage every 3 real minutes, measured from the planting timestamp so time
// spent with the app closed counts (catch-up on load).
export class WheatGrowth {
  constructor(world) {
    this.world = world;
    this.planted = new Map(); // key -> planted timestamp
    this.acc = 0;
    this.onChange = null;
  }

  onBlockChanged(x, y, z, id, prev) {
    const k = key(x, y, z);
    if (id === WHEAT_1) {
      this.planted.set(k, Date.now());
      this.onChange?.();
    } else if (isWheat(id)) {
      if (!this.planted.has(k)) { this.planted.set(k, Date.now() - (id - WHEAT_1) * STAGE_MS); this.onChange?.(); }
    } else if (isWheat(prev) && this.planted.has(k)) {
      this.planted.delete(k);
      this.onChange?.();
    }
  }

  // Apply growth to every tracked plant. Returns the number of blocks advanced.
  tick() {
    const now = Date.now();
    let n = 0;
    for (const [k, t] of this.planted) {
      const [x, y, z] = k.split(',').map(Number);
      const cur = this.world.getBlock(x, y, z);
      if (!isWheat(cur)) { this.planted.delete(k); continue; }
      const stage = Math.min(2, Math.floor((now - t) / STAGE_MS));
      const want = WHEAT_1 + stage;
      if (cur < want) { this.world.setBlock(x, y, z, want); n++; }
    }
    return n;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < 10) return 0;
    this.acc = 0;
    return this.tick();
  }

  serialize() {
    return [...this.planted.entries()];
  }

  load(entries) {
    if (!Array.isArray(entries)) return;
    for (const [k, t] of entries) this.planted.set(k, t);
    this.tick();
  }
}
