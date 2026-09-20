import { fbm2, valueNoise2, hash2, mulberry32 } from './noise.js';
import { CY } from './chunk.js';
import {
  GRASS, DIRT, STONE, COBBLE, SAND, OAK_TRUNK, LEAVES, APPLE_LEAVES, FLOWER_LEAVES, BEDROCK, WATER,
  GRASS_TUFT, FLOWER_RED, FLOWER_YELLOW, FLOWER_BLUE, AIR,
} from '../data/blocks.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function generateTerrain(world) {
  const seed = world.seed;
  const SX = world.sizeX, SZ = world.sizeZ;
  const plaza = { cx: SX / 2, cz: SZ / 2, half: world.cfg.plazaSize / 2 };
  const pond = { cx: 86, cz: 50, r: 6 };

  const rawHeight = (x, z) => 16 + (fbm2(x / 38 + 3.7, z / 38 + 9.1, seed, 2) - 0.5) * 18;
  const plazaH = Math.round(rawHeight(plaza.cx, plaza.cz));
  const pondH = Math.round(rawHeight(pond.cx, pond.cz));

  // --- column heights and surface material ---
  const heights = new Int16Array(SX * SZ);
  const surface = new Uint8Array(SX * SZ); // 0 grass, 1 stone outcrop, 2 sand (pond), 3 cobble outcrop
  const waterTop = new Int16Array(SX * SZ).fill(-1);

  for (let z = 0; z < SZ; z++) {
    for (let x = 0; x < SX; x++) {
      const i = z * SX + x;
      let h = rawHeight(x, z);
      let surf = 0;

      // plaza: flat square with a 6-block blend
      const dPlaza = Math.max(Math.abs(x - plaza.cx + 0.5), Math.abs(z - plaza.cz + 0.5)) - plaza.half;
      if (dPlaza <= 0) h = plazaH;
      else if (dPlaza < 6) h = lerp(plazaH, h, dPlaza / 6);

      // pond: bowl with a sand rim, water one block below the rim
      const dx = x + 0.5 - pond.cx, dz = z + 0.5 - pond.cz;
      const r = Math.sqrt(dx * dx + dz * dz);
      if (r < pond.r) {
        h = pondH - 2 - Math.floor((1 - r / pond.r) * 2.5);
        surf = 2;
        waterTop[i] = pondH - 1;
      } else if (r < pond.r + 4) {
        h = lerp(pondH, h, (r - pond.r) / 4);
        if (r < pond.r + 1.5) surf = 2;
      }

      // stone outcrops (never on the plaza or pond)
      if (dPlaza > 1 && r > pond.r + 4) {
        const o = valueNoise2(x / 19 + 77.3, z / 19 - 33.1, seed + 7);
        if (o > 0.74) {
          surf = o > 0.82 ? 3 : 1;
          h += (o - 0.74) * 12;
        }
      }

      heights[i] = clamp(Math.round(h), 3, CY - 12);
      surface[i] = surf;
    }
  }

  // --- fill columns ---
  for (let z = 0; z < SZ; z++) {
    for (let x = 0; x < SX; x++) {
      const i = z * SX + x;
      const h = heights[i], surf = surface[i];
      world.setRaw(x, 0, z, BEDROCK);
      for (let y = 1; y <= h; y++) {
        let id;
        if (y < h - 3) id = STONE;
        else if (y < h) id = surf === 2 ? SAND : DIRT;
        else id = surf === 0 ? GRASS : surf === 1 ? STONE : surf === 3 ? COBBLE : SAND;
        world.setRaw(x, y, z, id);
      }
      if (waterTop[i] >= 0) for (let y = h + 1; y <= waterTop[i]; y++) world.setRaw(x, y, z, WATER);
    }
  }

  // --- trees: one candidate per 7x7 cell ---
  const rng = mulberry32(seed ^ 0x5eed);
  for (let cz = 0; cz < SZ; cz += 7) {
    for (let cx = 0; cx < SX; cx += 7) {
      const roll = rng(), ox = Math.floor(rng() * 7), oz = Math.floor(rng() * 7);
      const trunkH = 4 + Math.floor(rng() * 3);
      const variant = rng();
      if (roll > 0.62) continue;
      const x = cx + ox, z = cz + oz;
      if (x < 3 || z < 3 || x >= SX - 3 || z >= SZ - 3) continue;
      const dPlaza = Math.max(Math.abs(x - plaza.cx + 0.5), Math.abs(z - plaza.cz + 0.5)) - plaza.half;
      if (dPlaza < 3) continue;
      const pdx = x + 0.5 - pond.cx, pdz = z + 0.5 - pond.cz;
      if (Math.sqrt(pdx * pdx + pdz * pdz) < pond.r + 4) continue;
      const i = z * SX + x;
      if (surface[i] !== 0) continue;
      const h = heights[i];
      if (h + trunkH + 2 >= CY - 1) continue;
      const leaf = variant < 0.15 ? APPLE_LEAVES : variant < 0.3 ? FLOWER_LEAVES : LEAVES;
      const top = h + trunkH;
      for (let y = h + 1; y <= top; y++) world.setRaw(x, y, z, OAK_TRUNK);
      for (let dy = -2; dy <= 1; dy++) {
        const y = top + dy;
        const rad = dy <= -1 ? 2 : dy === 0 ? 1 : 0;
        for (let ddx = -2; ddx <= 2; ddx++) {
          for (let ddz = -2; ddz <= 2; ddz++) {
            const ax = Math.abs(ddx), az = Math.abs(ddz);
            let ok = false;
            if (dy <= -1) ok = ax <= 2 && az <= 2 && !(ax === 2 && az === 2 && (dy === -2 || hash2(x + ddx, z + ddz, seed + y) < 0.5));
            else if (dy === 0) ok = ax <= 1 && az <= 1;
            else ok = ax + az <= 1;
            if (!ok || rad < 0) continue;
            if (world.getBlock(x + ddx, y, z + ddz) === AIR) world.setRaw(x + ddx, y, z + ddz, leaf);
          }
        }
      }
    }
  }

  // --- grass tufts and flowers on grass tops (not on the plaza) ---
  for (let z = 1; z < SZ - 1; z++) {
    for (let x = 1; x < SX - 1; x++) {
      const i = z * SX + x;
      if (surface[i] !== 0) continue;
      const dPlaza = Math.max(Math.abs(x - plaza.cx + 0.5), Math.abs(z - plaza.cz + 0.5)) - plaza.half;
      if (dPlaza <= 0) continue;
      const h = heights[i];
      if (world.getBlock(x, h, z) !== GRASS || world.getBlock(x, h + 1, z) !== AIR) continue;
      const roll = hash2(x, z, seed + 99);
      if (roll < 0.10) world.setRaw(x, h + 1, z, GRASS_TUFT);
      else if (roll < 0.12) world.setRaw(x, h + 1, z, roll < 0.1067 ? FLOWER_RED : roll < 0.1134 ? FLOWER_YELLOW : FLOWER_BLUE);
    }
  }

  world.spawn = { x: plaza.cx + 0.5, y: plazaH + 1, z: plaza.cz + 0.5 };
  world.plazaHeight = plazaH;
  return world;
}
