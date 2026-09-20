import { blockById, SHAPE } from '../data/blocks.js';

// Draws one textured parallelogram face: tile pixel (0,0)->p0, (16,0)->p1, (0,16)->p3.
export function drawFace(ctx, tile, p0, p1, p3, shade, dpr, sub = null) {
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
    if (sub) {
      // the face covers only part of the tile: sample that sub-rectangle stretched over the 16x16 space
      const su = sub.u0 * 16, sv = sub.v0 * 16, sw = (sub.u1 - sub.u0) * 16, sh = (sub.v1 - sub.v0) * 16;
      ctx.drawImage(tile, su, sv, Math.max(1, sw), Math.max(1, sh), 0, 0, 16, 16);
    } else ctx.drawImage(tile, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shade < 1) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(0,0,0,${1 - shade})`;
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
}

// Draws a list of sub-boxes ({lo, hi, tiles[6]} in 0..1 cell units) as an isometric mini model.
export function drawBoxesIso(ctx, tiles, boxes, size, dpr, pad = 4) {
  const K = 0.866;
  const hw = (size - 2 * pad) / 2, c = hw / K; // cube edge in px so the cell's iso width fits
  const ox = size / 2, oy = pad + c;
  const P = (x, y, z) => [ox + (x - z) * K * c, oy + (x + z) * 0.5 * c - y * c];
  const sorted = boxes.slice().sort((a, b) => a.lo[0] + a.lo[1] + a.lo[2] - (b.lo[0] + b.lo[1] + b.lo[2]));
  for (const bx of sorted) {
    const [x0, y0, z0] = bx.lo, [x1, y1, z1] = bx.hi;
    const t = bx.tiles;
    const sub = (tile, u0, v0, u1, v1) => ({ tile, u0, v0, u1, v1 });
    // top (+y): tile u along +x, v along +z
    drawFace(ctx, tiles[t[2]], P(x0, y1, z0), P(x1, y1, z0), P(x0, y1, z1), 1.0, dpr, sub(t[2], x0, z0, x1, z1));
    // +z face: u along +x, v downwards
    drawFace(ctx, tiles[t[4]], P(x0, y1, z1), P(x1, y1, z1), P(x0, y0, z1), 0.8, dpr, sub(t[4], x0, 1 - y1, x1, 1 - y0));
    // +x face: u along -z, v downwards
    drawFace(ctx, tiles[t[0]], P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z1), 0.62, dpr, sub(t[0], 1 - z1, 1 - y1, 1 - z0, 1 - y0));
  }
}

// Isometric mini-cube icons rendered once per block type to a small canvas and cached.
export function createBlockIconRenderer(atlas, size = 56) {
  const cache = new Map();
  const dpr = Math.min(2, window.devicePixelRatio || 1);

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
      drawBoxesIso(ctx, atlas.tiles, [{ lo: [0, 0, 0], hi: [1, 1, 1], tiles: block.faces }], S, dpr);
    } else if (block.shape === SHAPE.MODEL) {
      drawBoxesIso(ctx, atlas.tiles, block.model, S, dpr);
    } else {
      const m = 6;
      ctx.drawImage(atlas.tiles[block.tile], m, m, S - 2 * m, S - 2 * m);
    }
    cache.set(blockId, cv);
    return cv;
  }

  return { render };
}
