import { blockById, SHAPE } from '../data/blocks.js';

// Isometric mini-cube icons rendered once per block type to a small canvas and cached.
export function createBlockIconRenderer(atlas, size = 56) {
  const cache = new Map();
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  function face(ctx, tile, p0, p1, p3, shade) {
    // maps tile pixel (0,0)->p0, (16,0)->p1, (0,16)->p3
    const a = (p1[0] - p0[0]) / 16, b = (p1[1] - p0[1]) / 16;
    const c = (p3[0] - p0[0]) / 16, d = (p3[1] - p0[1]) / 16;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p1[0] + p3[0] - p0[0], p1[1] + p3[1] - p0[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, p0[0] * dpr, p0[1] * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tile, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shade < 1) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(0,0,0,${1 - shade})`;
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function render(blockId) {
    if (cache.has(blockId)) return cache.get(blockId);
    const block = blockById(blockId);
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(size * dpr);
    cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const S = size;
    if (block.shape === SHAPE.CUBE) {
      const hw = (S - 8) / 2, hh = hw / 2, fh = hw;
      const T = [S / 2, 4], L = [4, 4 + hh], Rr = [S - 4, 4 + hh], B = [S / 2, 4 + 2 * hh];
      const tiles = block.faces;
      face(ctx, atlas.tiles[tiles[2]], L, T, B, 1.0);
      face(ctx, atlas.tiles[tiles[1]], L, B, [L[0], L[1] + fh], 0.8);
      face(ctx, atlas.tiles[tiles[4]], B, Rr, [B[0], B[1] + fh], 0.62);
    } else {
      const m = 6;
      ctx.drawImage(atlas.tiles[block.tile], m, m, S - 2 * m, S - 2 * m);
    }
    cache.set(blockId, cv);
    return cv;
  }

  return { render };
}
