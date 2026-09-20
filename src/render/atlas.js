// Procedural texture atlas: 16x16 tiles of 64x64 px. Each tile is drawn as 16x16 pixel art and
// upscaled 4x with nearest-neighbour into the atlas; the GPU then samples 64 px tiles with mipmaps.
import * as THREE from 'three';
import { TILE } from '../data/blocks.js';
import { CONFIG } from '../config.js';
import { mulberry32 } from '../world/noise.js';

export const ATLAS_TILES = 16;
export const TILE_PX = 64;
export const ART_PX = 16;
export const ATLAS_PX = ATLAS_TILES * TILE_PX;
export const PAD_PX = 2;

const TS = TILE_PX / ATLAS_PX, PADU = PAD_PX / ATLAS_PX;
const rectCache = new Map();
// UV rect [u0, v0, u1, v1] of a tile, inset by the 2 px bleed border. v=0 is the top of the atlas.
export function tileRect(tile) {
  let r = rectCache.get(tile);
  if (!r) {
    const tx = tile % ATLAS_TILES, ty = Math.floor(tile / ATLAS_TILES);
    r = [tx * TS + PADU, ty * TS + PADU, (tx + 1) * TS - PADU, (ty + 1) * TS - PADU];
    rectCache.set(tile, r);
  }
  return r;
}

const P = CONFIG.palette;

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

function makeTile(seed, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = ART_PX;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(ART_PX, ART_PX);
  const d = img.data;
  const rng = mulberry32(seed);
  const api = {
    rng,
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
      const i = (y * 16 + x) * 4;
      d[i] = clamp255(r); d[i + 1] = clamp255(g); d[i + 2] = clamp255(b); d[i + 3] = clamp255(a);
    },
    px(x, y, hex, a = 255) {
      const [r, g, b] = hexToRgb(hex);
      api.set(x, y, r, g, b, a);
    },
    // fill a rect with a colour, each pixel varied by ±amount (multiplicative)
    rect(x0, y0, w, h, hex, amount = 0, a = 255) {
      const [r, g, b] = hexToRgb(hex);
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const f = amount ? 1 + (rng() * 2 - 1) * amount : 1;
          api.set(x, y, r * f, g * f, b * f, a);
        }
      }
    },
    fill(hex, amount = 0, a = 255) {
      api.rect(0, 0, 16, 16, hex, amount, a);
    },
    mul(x, y, f) {
      if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
      const i = (y * 16 + x) * 4;
      d[i] = clamp255(d[i] * f); d[i + 1] = clamp255(d[i + 1] * f); d[i + 2] = clamp255(d[i + 2] * f);
    },
    ring(hex, a = 255) {
      for (let i = 0; i < 16; i++) {
        api.px(i, 0, hex, a); api.px(i, 15, hex, a); api.px(0, i, hex, a); api.px(15, i, hex, a);
      }
    },
    scatter(n, hex, size = 1) {
      for (let i = 0; i < n; i++) {
        const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16);
        api.rect(x, y, size, size, hex);
      }
    },
  };
  paint(api);
  ctx.putImageData(img, 0, 0);
  return c;
}

const woolPainter = (hex) => (t) => {
  t.fill(hex, 0.04);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) t.mul(x, y, 0.94);
};

const flowerPainter = (petal, center) => (t) => {
  t.rect(7, 8, 1, 8, '#3FA34D');
  t.rect(5, 12, 2, 1, '#3FA34D');
  t.rect(8, 13, 2, 1, '#3FA34D');
  t.px(6, 11, '#2E8A3A');
  t.rect(6, 3, 3, 1, petal); t.rect(5, 4, 5, 3, petal); t.rect(6, 7, 3, 1, petal);
  t.px(7, 5, center); t.px(8, 4, '#FFFFFF', 140);
};

const leavesPainter = (accent, highlight) => (t) => {
  t.fill(P.leaves, 0.16);
  t.scatter(10, '#2C6E1E');
  t.scatter(6, '#57A83A');
  if (accent) {
    for (let i = 0; i < 4; i++) {
      const x = 1 + Math.floor(t.rng() * 13), y = 1 + Math.floor(t.rng() * 13);
      t.rect(x, y, 2, 2, accent);
      t.px(x, y, highlight);
    }
  }
};

const crackPainter = (stage) => (t) => {
  const walks = 2 + stage * 2, len = 4 + stage * 3, a = 150 + stage * 25;
  for (let w = 0; w < walks; w++) {
    let x = 7 + Math.floor(t.rng() * 2), y = 7 + Math.floor(t.rng() * 2);
    let dx = t.rng() < 0.5 ? -1 : 1, dy = t.rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < len; i++) {
      t.set(x, y, 20, 20, 20, a);
      if (t.rng() < 0.5) x += dx; else y += dy;
      if (t.rng() < 0.15) dx = -dx;
      if (t.rng() < 0.15) dy = -dy;
    }
  }
};

const PAINTERS = {
  [TILE.GRASS_TOP]: (t) => {
    t.fill(P.grassTop, 0.09);
    t.scatter(14, '#7CCB4F');
    t.scatter(6, '#4E9B2F');
  },
  [TILE.GRASS_SIDE]: (t) => {
    t.fill(P.dirt, 0.1);
    t.scatter(4, '#5E3D22');
    for (let x = 0; x < 16; x++) {
      const depth = 3 + (t.rng() < 0.5 ? 1 : 0) + (t.rng() < 0.2 ? 1 : 0);
      t.rect(x, 0, 1, depth, P.grassSide, 0.06);
      t.px(x, 0, P.grassTop);
    }
  },
  [TILE.DIRT]: (t) => {
    t.fill(P.dirt, 0.12);
    t.scatter(5, '#5E3D22');
    t.scatter(3, '#8E6238');
  },
  [TILE.STONE]: (t) => {
    t.fill(P.stone, 0.07);
    for (let k = 0; k < 3; k++) {
      let x = Math.floor(t.rng() * 16), y = Math.floor(t.rng() * 16);
      for (let i = 0; i < 4; i++) {
        t.mul(x, y, 0.8);
        if (t.rng() < 0.5) x += t.rng() < 0.5 ? 1 : -1; else y += 1;
      }
    }
  },
  [TILE.COBBLE]: (t) => {
    t.fill('#5A5A5A', 0.05);
    const stones = [[0, 0, 5, 4], [6, 0, 5, 3], [12, 0, 4, 4], [0, 5, 4, 4], [5, 4, 6, 5], [12, 5, 4, 4], [0, 10, 6, 6], [7, 10, 4, 6], [12, 10, 4, 6]];
    for (const [x, y, w, h] of stones) {
      const f = 0.85 + t.rng() * 0.3;
      const [r, g, b] = hexToRgb(P.cobble);
      for (let yy = y; yy < y + h - 1; yy++) {
        for (let xx = x; xx < x + w - 1; xx++) {
          const corner = (xx === x || xx === x + w - 2) && (yy === y || yy === y + h - 2);
          if (corner) continue;
          const n = 1 + (t.rng() * 2 - 1) * 0.05;
          t.set(xx, yy, r * f * n, g * f * n, b * f * n);
        }
      }
      t.mul(x, y + 1, 1.12);
      t.mul(x + 1, y, 1.12);
    }
  },
  [TILE.STONE_BRICK]: (t) => {
    t.fill('#6E6E6E', 0.04);
    for (let row = 0; row < 4; row++) {
      const y0 = row * 4;
      const seams = row % 2 === 0 ? [7] : [3, 11];
      for (let x = 0; x < 16; x++) {
        if (seams.includes(x)) continue;
        t.rect(x, y0, 1, 3, P.stoneBrick, 0.05);
        t.mul(x, y0, 1.1);
        t.mul(x, y0 + 2, 0.86);
      }
    }
  },
  [TILE.SAND]: (t) => {
    t.fill(P.sand, 0.06);
    t.scatter(6, '#D2BF85');
  },
  [TILE.SANDSTONE_SIDE]: (t) => {
    for (let y = 0; y < 16; y++) t.rect(0, y, 16, 1, y % 4 === 3 ? '#CFBB7C' : '#E0CC90', 0.04);
    t.rect(0, 0, 16, 1, '#EAD9A6');
  },
  [TILE.SANDSTONE_TOP]: (t) => {
    t.fill('#E4D39A', 0.05);
    t.ring('#D2BF85');
  },
  [TILE.OAK_SIDE]: (t) => {
    const [r, g, b] = hexToRgb(P.trunk);
    for (let x = 0; x < 16; x++) {
      const f = 0.82 + t.rng() * 0.36;
      for (let y = 0; y < 16; y++) {
        const n = 1 + (t.rng() * 2 - 1) * 0.06;
        t.set(x, y, r * f * n, g * f * n, b * f * n);
      }
    }
    t.rect(4, 6, 2, 3, '#3F2A15');
    t.rect(11, 11, 2, 2, '#3F2A15');
  },
  [TILE.OAK_TOP]: (t) => {
    t.fill(P.trunk, 0.08);
    t.rect(2, 2, 12, 12, '#A97C4B', 0.05);
    for (let i = 4; i < 12; i++) { t.px(i, 4, '#8C6238'); t.px(i, 11, '#8C6238'); t.px(4, i, '#8C6238'); t.px(11, i, '#8C6238'); }
    for (let i = 6; i < 10; i++) { t.px(i, 6, '#8C6238'); t.px(i, 9, '#8C6238'); t.px(6, i, '#8C6238'); t.px(9, i, '#8C6238'); }
    t.rect(7, 7, 2, 2, '#7A5230');
  },
  [TILE.PLANKS]: (t) => {
    const [r, g, b] = hexToRgb(P.planks);
    for (let y = 0; y < 16; y++) {
      const rowF = 0.94 + t.rng() * 0.12;
      for (let x = 0; x < 16; x++) {
        const n = 1 + (t.rng() * 2 - 1) * 0.05;
        t.set(x, y, r * rowF * n, g * rowF * n, b * rowF * n);
      }
    }
    for (const y of [3, 7, 11, 15]) t.rect(0, y, 16, 1, '#7E5A26');
    t.rect(11, 0, 1, 3, '#7E5A26'); t.rect(11, 8, 1, 3, '#7E5A26');
    t.rect(4, 4, 1, 3, '#7E5A26'); t.rect(4, 12, 1, 3, '#7E5A26');
    for (const [x, y] of [[1, 1], [13, 1], [6, 5], [14, 5], [1, 9], [13, 9], [6, 13], [14, 13]]) t.px(x, y, '#6B4A1E');
  },
  [TILE.LEAVES]: leavesPainter(null),
  [TILE.LEAVES_APPLE]: leavesPainter(P.apple, '#FF7070'),
  [TILE.LEAVES_FLOWER]: leavesPainter(P.blossom, '#FFC8DC'),
  [TILE.ROOF]: (t) => {
    t.fill(P.roofing, 0.06);
    for (let y = 0; y < 16; y++) {
      if (y % 4 === 3) t.rect(0, y, 16, 1, '#6B3410');
      if (y % 4 === 0) t.rect(0, y, 16, 1, '#A75A2A', 0.05);
    }
    for (let g = 0; g < 4; g++) {
      for (let x = 0; x < 16; x++) if ((x + g * 4) % 8 === 0) t.rect(x, g * 4, 1, 3, '#6B3410');
    }
  },
  [TILE.GLASS]: (t) => {
    t.fill('#C8E6FF', 0, 89);
    t.ring(P.glassFrame);
    for (let x = 3; x <= 9; x++) { t.set(x, 12 - x, 255, 255, 255, 150); t.set(x + 1, 12 - x, 255, 255, 255, 150); }
  },
  [TILE.GLASS_FRAME]: (t) => {
    t.fill('#000000', 0, 0);
    t.ring(P.glassFrame);
  },
  [TILE.BEDROCK]: (t) => {
    t.fill('#3A3A3A', 0.25);
    t.scatter(6, '#555555', 2);
  },
  [TILE.WATER]: (t) => {
    t.fill(P.water, 0.04, 166);
    for (const row of [3, 9]) for (let x = 0; x < 16; x++) if ((x + row) % 6 < 3) t.set(x, row, 110, 170, 240, 180);
  },
  [TILE.TORCH]: (t) => {
    t.fill('#000000', 0, 0);
    t.rect(7, 9, 2, 7, '#7A4B2A');
    t.rect(7, 9, 1, 7, '#8A5A36');
    t.rect(6, 7, 4, 2, '#F08A2A');
    t.rect(7, 6, 2, 3, '#F2C230');
    t.rect(7, 7, 2, 1, '#FFE070');
    t.px(7, 5, '#FFF3B0');
  },
  [TILE.FENCE]: (t) => {
    const [r, g, b] = hexToRgb('#A0743A');
    for (let x = 0; x < 16; x++) {
      const f = 0.9 + t.rng() * 0.2;
      for (let y = 0; y < 16; y++) {
        const n = 1 + (t.rng() * 2 - 1) * 0.05;
        t.set(x, y, r * f * n, g * f * n, b * f * n);
      }
    }
    t.rect(0, 0, 1, 16, '#7E5A26'); t.rect(15, 0, 1, 16, '#7E5A26');
  },
  [TILE.GHOST]: (t) => {
    t.fill('#A0C8FF', 0, 110);
    t.ring('#FFFFFF', 200);
  },
  [TILE.GRASS_TUFT]: (t) => {
    t.fill('#000000', 0, 0);
    const cols = ['#5FB33A', '#4E9E30', '#6FC048'];
    for (let k = 0; k < 6; k++) {
      const x0 = 2 + k * 2 + (t.rng() < 0.5 ? 1 : 0);
      const h = 5 + Math.floor(t.rng() * 7);
      const c = cols[k % 3];
      for (let y = 15; y >= 15 - h; y--) t.px(x0, y, c);
      t.px(x0 + (k % 2 ? 1 : -1), 14 - h, c);
    }
  },
  [TILE.FLOWER_RED]: flowerPainter(P.wool[0], P.wool[1]),
  [TILE.FLOWER_YELLOW]: flowerPainter(P.wool[1], P.wool[9]),
  [TILE.FLOWER_BLUE]: flowerPainter(P.wool[2], P.wool[5]),
  [TILE.WHEAT_1]: (t) => {
    t.fill('#000000', 0, 0);
    for (const x of [2, 5, 8, 11, 14]) t.rect(x, 12, 1, 4, '#5FB33A');
  },
  [TILE.WHEAT_2]: (t) => {
    t.fill('#000000', 0, 0);
    for (const x of [2, 5, 8, 11, 14]) { t.rect(x, 7, 1, 9, '#7FBF3A'); t.px(x, 6, '#C8C040'); }
  },
  [TILE.WHEAT_3]: (t) => {
    t.fill('#000000', 0, 0);
    for (const x of [2, 5, 8, 11, 14]) {
      t.rect(x, 3, 1, 13, '#C9A83A');
      t.rect(x - 1, 2, 3, 4, '#E8C450');
      t.px(x, 2, '#F2D878'); t.px(x, 4, '#F2D878');
    }
  },
  [TILE.PUMPKIN_SIDE]: (t) => {
    t.fill('#F08A2A', 0.05);
    for (const x of [3, 7, 11, 15]) t.rect(x, 0, 1, 16, '#C96E1A');
    for (const x of [1, 5, 9, 13]) t.rect(x, 0, 1, 16, '#F8A044', 0.04);
  },
  [TILE.PUMPKIN_TOP]: (t) => {
    t.fill('#E07A20', 0.05);
    t.rect(7, 0, 2, 16, '#C96E1A'); t.rect(0, 7, 16, 2, '#C96E1A');
    t.rect(7, 7, 2, 2, '#5B8A2A');
  },
  [TILE.PUMPKIN_FACE]: (t) => {
    PAINTERS[TILE.PUMPKIN_SIDE](t);
    t.rect(4, 5, 2, 2, '#2A2A2A'); t.rect(10, 5, 2, 2, '#2A2A2A');
    t.rect(4, 10, 8, 1, '#2A2A2A'); t.px(5, 9, '#2A2A2A'); t.px(10, 9, '#2A2A2A'); t.px(7, 11, '#2A2A2A'); t.px(8, 11, '#2A2A2A');
  },
  [TILE.MUSHROOM]: (t) => {
    t.fill('#000000', 0, 0);
    t.rect(6, 9, 4, 7, '#F2F2F2'); t.rect(6, 9, 1, 7, '#D8D8D8');
    t.rect(5, 4, 6, 1, '#D9403A'); t.rect(4, 5, 8, 1, '#D9403A'); t.rect(3, 6, 10, 4, '#D9403A');
    t.rect(3, 9, 10, 1, '#B8302C');
    t.px(5, 6, '#F2F2F2'); t.px(9, 7, '#F2F2F2'); t.px(7, 5, '#F2F2F2');
  },
  [TILE.CACTUS_SIDE]: (t) => {
    t.fill('#3FA34D', 0.06);
    for (const x of [0, 5, 10, 15]) t.rect(x, 0, 1, 16, '#2E8A3A');
    for (const [x, y] of [[2, 3], [7, 8], [12, 2], [3, 12], [8, 13], [13, 10]]) t.px(x, y, '#E8F0E0');
  },
  [TILE.CACTUS_TOP]: (t) => {
    t.fill('#3FA34D', 0.06);
    t.ring('#2E8A3A');
    t.rect(4, 4, 8, 8, '#5CB86A', 0.04);
  },
  [TILE.DARK_PLANKS]: (t) => {
    PAINTERS[TILE.PLANKS](t);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.mul(x, y, 0.62);
  },
  [TILE.DOOR_BOTTOM]: (t) => {
    t.fill('#8E6530', 0.05);
    t.ring('#5E4020');
    t.rect(3, 2, 10, 5, '#A6783C', 0.04); t.rect(3, 9, 10, 5, '#A6783C', 0.04);
    for (let x = 3; x < 13; x++) { t.px(x, 2, '#6E4A22'); t.px(x, 9, '#6E4A22'); }
    t.px(11, 8, '#F2C230'); t.px(12, 8, '#F2C230');
  },
  [TILE.DOOR_TOP]: (t) => {
    t.fill('#8E6530', 0.05);
    t.ring('#5E4020');
    t.rect(3, 9, 10, 5, '#A6783C', 0.04);
    for (let x = 3; x < 13; x++) t.px(x, 9, '#6E4A22');
    t.rect(4, 2, 8, 5, '#5E4020');
    t.rect(5, 3, 6, 3, '#BFE3FF');
    t.px(8, 3, '#5E4020'); t.px(8, 4, '#5E4020'); t.px(8, 5, '#5E4020');
  },
  [TILE.PICTURE]: (t) => {
    t.fill('#5E4020');
    t.rect(1, 1, 14, 14, '#7FC2F0');
    t.rect(1, 9, 14, 6, '#5FB33A', 0.06);
    t.rect(1, 8, 6, 1, '#3E8E2C'); t.rect(9, 7, 6, 2, '#3E8E2C');
    t.rect(11, 2, 3, 3, '#F2C230'); t.px(12, 2, '#FFE070');
    t.rect(4, 5, 1, 4, '#5C3F22'); t.rect(2, 3, 5, 3, '#3E8E2C'); t.px(4, 2, '#3E8E2C');
    t.rect(2, 11, 3, 1, '#D9403A');
  },
  [TILE.CLOCK]: (t) => {
    t.fill('#5E4020');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7.2) t.px(x, y, d > 6.2 ? '#2A2A2A' : '#F2F2F2');
    }
    for (const [x, y] of [[7, 2], [8, 2], [13, 7], [13, 8], [7, 13], [8, 13], [2, 7], [2, 8]]) t.px(x, y, '#2A2A2A');
    t.rect(7, 4, 2, 4, '#2A2A2A'); t.rect(8, 7, 4, 2, '#2A2A2A'); t.px(7, 7, '#D9403A'); t.px(8, 8, '#D9403A');
  },
  [TILE.BOOKS]: (t) => {
    const cols = [P.wool[0], P.wool[2], P.wool[3], P.wool[1], P.wool[4], P.wool[9], P.wool[7], P.wool[8]];
    let x = 0, i = 0;
    while (x < 16) {
      const w = 1 + (i % 2);
      t.rect(x, 0, w, 16, cols[i % cols.length], 0.05);
      t.rect(x, 2, w, 1, '#2A2A2A'); t.rect(x, 12, w, 1, '#2A2A2A');
      x += w; i++;
    }
  },
  [TILE.CRACK_0]: crackPainter(0),
  [TILE.CRACK_1]: crackPainter(1),
  [TILE.CRACK_2]: crackPainter(2),
  [TILE.CRACK_3]: crackPainter(3),
};
for (let i = 0; i < 11; i++) PAINTERS[TILE.WOOL_0 + i] = woolPainter(P.wool[i]);

export function buildAtlas() {
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = ATLAS_PX;
  const actx = atlas.getContext('2d');
  actx.imageSmoothingEnabled = false;
  const tiles = [];
  const avgColors = [];
  for (let tile = 0; tile < ATLAS_TILES * ATLAS_TILES; tile++) {
    const paint = PAINTERS[tile];
    if (!paint) continue;
    const c = makeTile(1000 + tile * 7919, paint);
    tiles[tile] = c;
    const tx = tile % ATLAS_TILES, ty = Math.floor(tile / ATLAS_TILES);
    actx.drawImage(c, 0, 0, ART_PX, ART_PX, tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
    // average colour for particles
    const d = c.getContext('2d').getImageData(0, 0, ART_PX, ART_PX).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    avgColors[tile] = n ? [r / n / 255, g / n / 255, b / n / 255] : [1, 1, 1];
  }
  const texture = new THREE.CanvasTexture(atlas);
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { canvas: atlas, texture, tiles, avgColors };
}
