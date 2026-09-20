import { Chunk, CH, CY } from './chunk.js';
import { BEDROCK } from '../data/blocks.js';

export class World {
  constructor(config) {
    this.cfg = config.world;
    this.seed = this.cfg.seed;
    this.sizeX = this.cfg.sizeX;
    this.sizeZ = this.cfg.sizeZ;
    this.height = this.cfg.height;
    this.chunksX = this.cfg.chunksX;
    this.chunksZ = this.cfg.chunksZ;
    this.chunks = [];
    for (let cz = 0; cz < this.chunksZ; cz++) {
      for (let cx = 0; cx < this.chunksX; cx++) this.chunks.push(new Chunk(cx, cz));
    }
    this.dirtyQueue = [];
    this.onChange = null; // set by the autosaver
    this.onBlockChanged = null; // (x, y, z, id, prev) for wheat growth and torch lights
    this.spawn = { x: 64.5, y: 20, z: 64.5 };
  }

  chunkAt(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.chunksX || cz >= this.chunksZ) return null;
    return this.chunks[cz * this.chunksX + cx];
  }

  inBounds(x, y, z) {
    return x >= 0 && z >= 0 && x < this.sizeX && z < this.sizeZ && y >= 0 && y < CY;
  }

  getBlock(x, y, z) {
    if (y < 0) return BEDROCK; // nothing is ever visible below bedrock
    if (y >= CY || x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ) return 0;
    const c = this.chunks[(z >> 4) * this.chunksX + (x >> 4)];
    return c.data[(y * CH + (z & 15)) * CH + (x & 15)];
  }

  // Direct write used by terrain generation (no edit tracking, no dirtying).
  setRaw(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    const c = this.chunks[(z >> 4) * this.chunksX + (x >> 4)];
    c.data[(y * CH + (z & 15)) * CH + (x & 15)] = id;
  }

  // Player/game edit: records a diff, marks chunks dirty, notifies the autosaver.
  // recordAs: value stored in the edit diff instead of `id` (ghost blocks are recorded as air).
  setBlock(x, y, z, id, { record = true, notify = true, recordAs } = {}) {
    if (!this.inBounds(x, y, z)) return false;
    const c = this.chunks[(z >> 4) * this.chunksX + (x >> 4)];
    const lx = x & 15, lz = z & 15;
    const idx = (y * CH + lz) * CH + lx;
    const prev = c.data[idx];
    if (prev === id) return false;
    c.data[idx] = id;
    if (record) c.edits.set(idx, recordAs ?? id);
    this.markDirty(c);
    if (lx === 0) this.markDirty(this.chunkAt(c.cx - 1, c.cz));
    if (lx === CH - 1) this.markDirty(this.chunkAt(c.cx + 1, c.cz));
    if (lz === 0) this.markDirty(this.chunkAt(c.cx, c.cz - 1));
    if (lz === CH - 1) this.markDirty(this.chunkAt(c.cx, c.cz + 1));
    if (notify && this.onChange) this.onChange();
    this.onBlockChanged?.(x, y, z, id, prev);
    return true;
  }

  markDirty(c) {
    if (!c || c.dirty) return;
    c.dirty = true;
    this.dirtyQueue.push(c);
  }

  markAllDirty() {
    for (const c of this.chunks) {
      c.dirty = false;
      this.markDirty(c);
    }
  }

  // Highest non-air block in a column, or -1.
  topAt(x, z) {
    for (let y = CY - 1; y >= 0; y--) if (this.getBlock(x, y, z) !== 0) return y;
    return -1;
  }
}
