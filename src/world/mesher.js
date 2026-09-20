// Chunk mesher: one merged geometry per render group (opaque / cutout / transparent) with
// hidden-face culling and 4-level baked vertex ambient occlusion.
import { CH, CY } from './chunk.js';
import { BLOCKS, OPAQUE, SHAPE_OF, GROUP_OF, CULL_SAME, LIQUID, SHAPE, FENCE } from '../data/blocks.js';
import { CONFIG } from '../config.js';
import { tileRect } from '../render/atlas.js';

const PW = CH + 2, PH = CY + 2;
const pidx = (x, y, z) => ((y + 1) * PW + (z + 1)) * PW + (x + 1);

// Face tables. axis: fixed axis; pos: 1 for the + side; u/v: [axis, sign] of the face's texture
// axes (v=0 is the top of the tile). Corner order is TL, TR, BR, BL in face screen space.
const FACES = [
  { n: [1, 0, 0], axis: 0, pos: 1, u: [2, -1], v: [1, -1] },
  { n: [-1, 0, 0], axis: 0, pos: 0, u: [2, 1], v: [1, -1] },
  { n: [0, 1, 0], axis: 1, pos: 1, u: [0, 1], v: [2, 1] },
  { n: [0, -1, 0], axis: 1, pos: 0, u: [0, -1], v: [2, 1] },
  { n: [0, 0, 1], axis: 2, pos: 1, u: [0, 1], v: [1, -1] },
  { n: [0, 0, -1], axis: 2, pos: 0, u: [0, -1], v: [1, -1] },
];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Precomputed per face/corner: axis fractions, texture fractions, AO neighbour offsets.
const FC = FACES.map((F) =>
  CORNERS.map(([cu, cv]) => {
    const ua = F.u[0], us = F.u[1], va = F.v[0], vs = F.v[1];
    const tu = us > 0 ? cu : 1 - cu; // fraction along axis ua
    const tv = vs > 0 ? cv : 1 - cv;
    const su = tu > 0.5 ? 1 : -1, sv = tv > 0.5 ? 1 : -1;
    const s1 = [...F.n], s2 = [...F.n], s3 = [...F.n];
    s1[ua] += su;
    s2[va] += sv;
    s3[ua] += su;
    s3[va] += sv;
    return { ua, va, us, vs, tu, tv, s1, s2, s3 };
  })
);

const AO = CONFIG.render.aoLevels;
const SHADE = CONFIG.render.faceShade;

class Builder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.vcount = 0;
  }
  quad(flip) {
    const b = this.vcount;
    if (!flip) this.idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
    else this.idx.push(b + 1, b, b + 3, b + 1, b + 3, b + 2);
    this.vcount += 4;
  }
  vertex(x, y, z, nx, ny, nz, u, v, c) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(c, c, c);
  }
  result() {
    if (this.vcount === 0) return null;
    return {
      pos: new Float32Array(this.pos),
      nrm: new Float32Array(this.nrm),
      uv: new Float32Array(this.uv),
      col: new Float32Array(this.col),
      idx: this.vcount > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
    };
  }
}

const lo = [0, 0, 0], hi = [1, 1, 1];
const P = [0, 0, 0];

// Emits one face of an axis-aligned box [lo,hi] (block-local units) at block (x,y,z).
function emitFace(b, pad, x, y, z, f, tile, lo, hi, useAO, shade) {
  const F = FACES[f], corners = FC[f];
  const r = tileRect(tile);
  const aos = [3, 3, 3, 3];
  for (let c = 0; c < 4; c++) {
    const K = corners[c];
    P[0] = 0; P[1] = 0; P[2] = 0;
    P[F.axis] = F.pos ? hi[F.axis] : lo[F.axis];
    P[K.ua] = lo[K.ua] + K.tu * (hi[K.ua] - lo[K.ua]);
    P[K.va] = lo[K.va] + K.tv * (hi[K.va] - lo[K.va]);
    const tileU = K.us > 0 ? P[K.ua] : 1 - P[K.ua];
    const tileV = K.vs > 0 ? P[K.va] : 1 - P[K.va];
    let ao = 3;
    if (useAO) {
      const o1 = OPAQUE[pad[pidx(x + K.s1[0], y + K.s1[1], z + K.s1[2])]];
      const o2 = OPAQUE[pad[pidx(x + K.s2[0], y + K.s2[1], z + K.s2[2])]];
      const o3 = OPAQUE[pad[pidx(x + K.s3[0], y + K.s3[1], z + K.s3[2])]];
      ao = o1 && o2 ? 0 : 3 - (o1 + o2 + o3);
    }
    aos[c] = ao;
    b.vertex(
      x + P[0], y + P[1], z + P[2],
      F.n[0], F.n[1], F.n[2],
      r[0] + tileU * (r[2] - r[0]), r[1] + tileV * (r[3] - r[1]),
      AO[ao] * shade
    );
  }
  // Choose the quad diagonal that passes through the darker corner pair (avoids AO anisotropy).
  b.quad(aos[0] + aos[2] > aos[1] + aos[3]);
}

function emitBox(b, pad, x, y, z, tile, lo, hi, skipMask) {
  for (let f = 0; f < 6; f++) {
    if (skipMask & (1 << f)) continue;
    emitFace(b, pad, x, y, z, f, tile, lo, hi, false, SHADE[f]);
  }
}

// Sub-box with per-face tiles; faces flush with the cell boundary next to an opaque block are skipped.
function emitModelBox(b, pad, x, y, z, mb) {
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    const flush = F.pos ? mb.hi[F.axis] >= 0.999 : mb.lo[F.axis] <= 0.001;
    if (flush && OPAQUE[pad[pidx(x + F.n[0], y + F.n[1], z + F.n[2])]]) continue;
    emitFace(b, pad, x, y, z, f, mb.tiles[f], mb.lo, mb.hi, false, SHADE[f]);
  }
}

function emitCross(b, x, y, z, tile, bright) {
  const r = tileRect(tile);
  const h = 0.98;
  // quad A: (0,0)->(1,1) diagonal
  b.vertex(x, y + h, z, 0.7071, 0, -0.7071, r[0], r[1], bright);
  b.vertex(x + 1, y + h, z + 1, 0.7071, 0, -0.7071, r[2], r[1], bright);
  b.vertex(x + 1, y, z + 1, 0.7071, 0, -0.7071, r[2], r[3], bright);
  b.vertex(x, y, z, 0.7071, 0, -0.7071, r[0], r[3], bright);
  b.quad(false);
  // quad B: (1,0)->(0,1) diagonal
  b.vertex(x + 1, y + h, z, 0.7071, 0, 0.7071, r[0], r[1], bright);
  b.vertex(x, y + h, z + 1, 0.7071, 0, 0.7071, r[2], r[1], bright);
  b.vertex(x, y, z + 1, 0.7071, 0, 0.7071, r[2], r[3], bright);
  b.vertex(x + 1, y, z, 0.7071, 0, 0.7071, r[0], r[3], bright);
  b.quad(false);
}

const S = 1 / 16;

export function meshChunk(world, chunk) {
  // Padded copy of the chunk with a 1-block border so every neighbour lookup is an array read.
  const pad = new Uint8Array(PW * PH * PW);
  const ox = chunk.cx * CH, oz = chunk.cz * CH;
  const data = chunk.data;
  for (let y = 0; y < CY; y++) {
    for (let z = 0; z < CH; z++) {
      const row = (y * CH + z) * CH;
      pad.set(data.subarray(row, row + CH), pidx(0, y, z));
    }
  }
  for (let y = -1; y <= CY; y++) {
    for (let z = -1; z <= CH; z++) {
      const edgeZ = z === -1 || z === CH;
      const edgeY = y === -1 || y === CY;
      for (let x = -1; x <= CH; x++) {
        if (!(edgeY || edgeZ || x === -1 || x === CH)) continue;
        pad[pidx(x, y, z)] = world.getBlock(ox + x, y, oz + z);
      }
    }
  }

  const builders = [new Builder(), new Builder(), new Builder()];

  for (let y = 0; y < CY; y++) {
    for (let z = 0; z < CH; z++) {
      for (let x = 0; x < CH; x++) {
        const id = pad[pidx(x, y, z)];
        if (id === 0) continue;
        const shape = SHAPE_OF[id];
        const b = builders[GROUP_OF[id]];
        const block = BLOCKS[id];

        if (shape === SHAPE.CUBE) {
          const liquid = LIQUID[id];
          hi[1] = 1;
          if (liquid && pad[pidx(x, y + 1, z)] !== id) hi[1] = 0.875;
          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const nb = pad[pidx(x + F.n[0], y + F.n[1], z + F.n[2])];
            if (nb !== 0) {
              if (OPAQUE[nb]) continue;
              if (nb === id && CULL_SAME[id]) continue;
            }
            emitFace(b, pad, x, y, z, f, block.faces[f], lo, hi, !liquid, SHADE[f]);
          }
          hi[1] = 1;
        } else if (shape === SHAPE.CROSS) {
          const below = OPAQUE[pad[pidx(x, y - 1, z)]] ? 1 : 0.9;
          emitCross(b, x, y, z, block.tile, 0.97 * below);
        } else if (shape === SHAPE.MODEL) {
          for (const mb of block.model) emitModelBox(b, pad, x, y, z, mb);
        } else if (shape === SHAPE.TORCH) {
          emitBox(b, pad, x, y, z, block.tile, [7 * S, 0, 7 * S], [9 * S, 10 * S, 9 * S], 1 << 3);
        } else if (shape === SHAPE.FENCE) {
          const belowOpaque = OPAQUE[pad[pidx(x, y - 1, z)]];
          emitBox(b, pad, x, y, z, block.tile, [6 * S, 0, 6 * S], [10 * S, 1, 10 * S], belowOpaque ? 1 << 3 : 0);
          const connects = (nb) => nb === FENCE || (OPAQUE[nb] && SHAPE_OF[nb] === SHAPE.CUBE);
          if (connects(pad[pidx(x + 1, y, z)])) {
            emitBox(b, pad, x, y, z, block.tile, [10 * S, 6 * S, 7 * S], [1, 9 * S, 9 * S], 1 << 1);
            emitBox(b, pad, x, y, z, block.tile, [10 * S, 12 * S, 7 * S], [1, 15 * S, 9 * S], 1 << 1);
          }
          if (connects(pad[pidx(x - 1, y, z)])) {
            emitBox(b, pad, x, y, z, block.tile, [0, 6 * S, 7 * S], [6 * S, 9 * S, 9 * S], 1 << 0);
            emitBox(b, pad, x, y, z, block.tile, [0, 12 * S, 7 * S], [6 * S, 15 * S, 9 * S], 1 << 0);
          }
          if (connects(pad[pidx(x, y, z + 1)])) {
            emitBox(b, pad, x, y, z, block.tile, [7 * S, 6 * S, 10 * S], [9 * S, 9 * S, 1], 1 << 5);
            emitBox(b, pad, x, y, z, block.tile, [7 * S, 12 * S, 10 * S], [9 * S, 15 * S, 1], 1 << 5);
          }
          if (connects(pad[pidx(x, y, z - 1)])) {
            emitBox(b, pad, x, y, z, block.tile, [7 * S, 6 * S, 0], [9 * S, 9 * S, 6 * S], 1 << 4);
            emitBox(b, pad, x, y, z, block.tile, [7 * S, 12 * S, 0], [9 * S, 15 * S, 6 * S], 1 << 4);
          }
        }
      }
    }
  }
  return builders.map((b) => b.result());
}
