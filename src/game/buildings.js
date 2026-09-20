import { BUILDING_BY_ID } from '../data/buildings/index.js';
import { GHOST, AIR, GRASS, DIRT, SOLID, LEAVES, APPLE_LEAVES, FLOWER_LEAVES, OAK_TRUNK } from '../data/blocks.js';
import { CY } from '../world/chunk.js';

const TREE = new Set([LEAVES, APPLE_LEAVES, FLOWER_LEAVES, OAK_TRUNK]);
const key = (x, y, z) => (x * CY + y) * 256 + z;

// Is this block the kind of ground a building can sit on?
export function isGround(id) {
  return SOLID[id] && !TREE.has(id) && id !== GHOST;
}

// Blueprint instances in the world. Unfilled voxels are GHOST blocks in the voxel grid (never
// recorded as world edits); filled voxels are real blocks recorded like any player edit.
export class BuildingManager {
  constructor(world) {
    this.world = world;
    this.instances = [];
    this.cells = new Map(); // cell key -> { inst, i }
    this.nextUid = 1;
    this.onChange = null;
    this.types = new Map(Object.entries(BUILDING_BY_ID));
  }

  registerType(type) {
    this.types.set(type.id, type);
  }

  typeById(id) {
    return this.types.get(id);
  }

  type(inst) {
    return this.types.get(inst.typeId);
  }

  cellAt(x, y, z) {
    return this.cells.get(key(x, y, z)) || null;
  }

  bbox(inst) {
    const t = this.type(inst);
    return { x0: inst.x, y0: inst.y, z0: inst.z, x1: inst.x + t.size[0], y1: inst.y + t.size[1], z1: inst.z + t.size[2] };
  }

  center(inst) {
    const t = this.type(inst);
    return { x: inst.x + t.size[0] / 2, y: inst.y + t.size[1] / 2, z: inst.z + t.size[2] / 2 };
  }

  placedCount(inst) {
    let n = 0;
    for (let i = 0; i < inst.filled.length; i++) n += inst.filled[i];
    return n;
  }

  // Can `type` be placed with its origin at (x0, y0, z0)?
  footprintValid(type, x0, y0, z0, player) {
    const [w, h, d] = type.size;
    const W = this.world;
    if (x0 < 1 || z0 < 1 || x0 + w > W.sizeX - 1 || z0 + d > W.sizeZ - 1) return { ok: false, reason: 'bounds' };
    if (y0 < 2 || y0 + h > CY - 2) return { ok: false, reason: 'height' };
    for (const inst of this.instances) {
      const b = this.bbox(inst);
      if (x0 < b.x1 + 1 && x0 + w > b.x0 - 1 && z0 < b.z1 + 1 && z0 + d > b.z0 - 1 && y0 < b.y1 + 1 && y0 + h > b.y0 - 1) {
        return { ok: false, reason: 'overlap' };
      }
    }
    if (player) {
      const hw = 0.3;
      if (player.x + hw > x0 && player.x - hw < x0 + w && player.z + hw > z0 && player.z - hw < z0 + d && player.y + 1.8 > y0 - 1 && player.y < y0 + h) {
        return { ok: false, reason: 'player' };
      }
    }
    return { ok: true };
  }

  // Fill below the footprint with dirt/grass and clear everything above it.
  flatten(type, x0, y0, z0) {
    const [w, h, d] = type.size;
    const W = this.world;
    for (let z = z0; z < z0 + d; z++) {
      for (let x = x0; x < x0 + w; x++) {
        for (let y = y0; y < Math.min(CY - 1, y0 + h + 3); y++) {
          if (W.getBlock(x, y, z) !== AIR) W.setBlock(x, y, z, AIR, { notify: false });
        }
        for (let y = y0 - 1; y >= 1; y--) {
          if (isGround(W.getBlock(x, y, z))) break;
          W.setBlock(x, y, z, y === y0 - 1 ? GRASS : DIRT, { notify: false });
        }
      }
    }
    W.onChange?.();
  }

  place(type, x0, y0, z0, { flatten = true } = {}) {
    if (flatten) this.flatten(type, x0, y0, z0);
    const inst = { uid: this.nextUid++, typeId: type.id, x: x0, y: y0, z: z0, filled: new Uint8Array(type.voxels.length), complete: false };
    this.instances.push(inst);
    this.apply(inst);
    this.onChange?.();
    return inst;
  }

  // Write an instance's voxels into the world grid (ghosts for unfilled, real blocks for filled).
  apply(inst) {
    const t = this.type(inst);
    const W = this.world;
    for (let i = 0; i < t.voxels.length; i++) {
      const [vx, vy, vz, id] = t.voxels[i];
      const x = inst.x + vx, y = inst.y + vy, z = inst.z + vz;
      this.cells.set(key(x, y, z), { inst, i });
      if (inst.filled[i]) {
        if (W.getBlock(x, y, z) !== id) W.setBlock(x, y, z, id, { record: true, notify: false });
      } else {
        W.setBlock(x, y, z, GHOST, { recordAs: AIR, notify: false });
      }
    }
    inst.complete = this.placedCount(inst) === t.voxels.length;
  }

  applyAll() {
    for (const inst of this.instances) this.apply(inst);
  }

  fill(inst, i) {
    const t = this.type(inst);
    if (inst.filled[i]) return null;
    const [vx, vy, vz, id] = t.voxels[i];
    inst.filled[i] = 1;
    this.world.setBlock(inst.x + vx, inst.y + vy, inst.z + vz, id, { record: true });
    const placed = this.placedCount(inst);
    inst.complete = placed === t.voxels.length;
    this.onChange?.();
    return { placed, total: t.voxels.length, complete: inst.complete, id };
  }

  unfill(inst, i) {
    const t = this.type(inst);
    if (!inst.filled[i]) return null;
    const [vx, vy, vz] = t.voxels[i];
    inst.filled[i] = 0;
    inst.complete = false;
    this.world.setBlock(inst.x + vx, inst.y + vy, inst.z + vz, GHOST, { recordAs: AIR });
    this.onChange?.();
    return { placed: this.placedCount(inst), total: t.voxels.length };
  }

  remove(inst) {
    const t = this.type(inst);
    for (let i = 0; i < t.voxels.length; i++) {
      const [vx, vy, vz] = t.voxels[i];
      const x = inst.x + vx, y = inst.y + vy, z = inst.z + vz;
      this.cells.delete(key(x, y, z));
      this.world.setBlock(x, y, z, AIR, { notify: false });
    }
    this.world.onChange?.();
    this.instances = this.instances.filter((b) => b !== inst);
    this.onChange?.();
  }

  nearestUnfinished(px, pz, maxDist) {
    let best = null, bestD = maxDist;
    for (const inst of this.instances) {
      if (inst.complete) continue;
      const c = this.center(inst);
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < bestD) { bestD = d; best = inst; }
    }
    return best;
  }

  serialize() {
    return {
      version: 1,
      initialized: true,
      nextUid: this.nextUid,
      instances: this.instances.map((b) => ({ uid: b.uid, typeId: b.typeId, x: b.x, y: b.y, z: b.z, filled: b.filled })),
    };
  }

  load(data) {
    if (!data || !Array.isArray(data.instances)) return false;
    this.instances = [];
    this.cells.clear();
    for (const r of data.instances) {
      const t = this.types.get(r.typeId);
      if (!t) continue;
      const filled = new Uint8Array(t.voxels.length);
      if (r.filled) filled.set(r.filled.subarray ? r.filled.subarray(0, filled.length) : r.filled.slice(0, filled.length));
      this.instances.push({ uid: r.uid, typeId: r.typeId, x: r.x, y: r.y, z: r.z, filled, complete: false });
    }
    this.nextUid = Math.max(data.nextUid || 1, ...this.instances.map((b) => b.uid + 1), 1);
    this.applyAll();
    return true;
  }
}
