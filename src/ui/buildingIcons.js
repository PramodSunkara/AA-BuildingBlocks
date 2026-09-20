import { drawFace } from './blockIcons.js';
import { blockById, SHAPE } from '../data/blocks.js';

// Isometric render of a whole blueprint (voxel painter's algorithm), cached per building/size.
export function createBuildingIconRenderer(atlas) {
  const cache = new Map();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const K = 0.866;

  function render(building, size = 150) {
    const ck = `${building.id}:${size}`;
    if (cache.has(ck)) return cache.get(ck);
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(size * dpr);
    cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const [w, h, d] = building.size;
    const px = (x, y, z) => [(x - z) * K, (x + z) * 0.5 - y];
    const corners = [px(0, 0, 0), px(w, 0, 0), px(0, 0, d), px(w, 0, d), px(0, h, 0), px(w, h, 0), px(0, h, d), px(w, h, d)];
    const minX = Math.min(...corners.map((c) => c[0])), maxX = Math.max(...corners.map((c) => c[0]));
    const minY = Math.min(...corners.map((c) => c[1])), maxY = Math.max(...corners.map((c) => c[1]));
    const c = Math.min((size - 12) / (maxX - minX), (size - 12) / (maxY - minY));
    const ox = (size - (maxX - minX) * c) / 2 - minX * c;
    const oy = (size - (maxY - minY) * c) / 2 - minY * c;
    const P = (x, y, z) => {
      const [a, b] = px(x, y, z);
      return [a * c + ox, b * c + oy];
    };

    const voxels = building.voxels.slice().sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    for (const [x, y, z, id] of voxels) {
      const block = blockById(id);
      if (block.shape === SHAPE.CUBE) {
        const f = block.faces;
        drawFace(ctx, atlas.tiles[f[2]], P(x, y + 1, z), P(x + 1, y + 1, z), P(x, y + 1, z + 1), 1.0, dpr);
        drawFace(ctx, atlas.tiles[f[4]], P(x, y + 1, z + 1), P(x + 1, y + 1, z + 1), P(x, y, z + 1), 0.8, dpr);
        drawFace(ctx, atlas.tiles[f[0]], P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x + 1, y, z + 1), 0.62, dpr);
      } else {
        const [cx, cy] = P(x + 0.5, y + 1, z + 0.5);
        ctx.drawImage(atlas.tiles[block.tile], cx - c / 2, cy, c, c);
      }
    }
    cache.set(ck, cv);
    return cv;
  }

  return { render };
}
