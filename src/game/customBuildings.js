import { AIR, GHOST } from '../data/blocks.js';

export const CUSTOM_MAX_SIZE = 16;
export const CUSTOM_MAX_BLOCKS = 600;

// Capture the box between two tapped cells as a custom blueprint.
export function captureRegion(world, a, b, index) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
  if (x1 - x0 >= CUSTOM_MAX_SIZE || y1 - y0 >= CUSTOM_MAX_SIZE || z1 - z0 >= CUSTOM_MAX_SIZE) return { ok: false, reason: 'size' };
  const voxels = [];
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const id = world.getBlock(x, y, z);
    if (id === AIR || id === GHOST) continue;
    voxels.push([x - x0, y - y0, z - z0, id]);
  }
  if (voxels.length < 2) return { ok: false, reason: 'empty' };
  if (voxels.length > CUSTOM_MAX_BLOCKS) return { ok: false, reason: 'count' };
  const type = {
    id: 'custom-' + Date.now().toString(36),
    name: 'My Build ' + index,
    level: 1, gemCost: 0,
    rewardXp: Math.min(600, voxels.length * 4),
    rewardGems: Math.min(10, Math.ceil(voxels.length / 20)),
    size: [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1],
    voxels, custom: true,
  };
  return { ok: true, type };
}
