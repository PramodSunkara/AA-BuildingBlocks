import * as THREE from 'three';
import { SPECIES } from '../data/animals.js';
import { SOLID, GHOST, LIQUID } from '../data/blocks.js';
import { mulberry32 } from '../world/noise.js';

const PX = 1 / 16;
const TEX = 32;

// Painted 32x32 texture per species: body (0,0,16,16), face (16,0,8,8), head (24,0,8,8), legs (0,16,16,8), extra (16,16,16,8)
function paintSpecies(name, sp) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = TEX;
  const ctx = cv.getContext('2d');
  const rng = mulberry32(name.length * 7919 + 13);
  const fill = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const shade = (hex, f) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, r * f) | 0},${Math.min(255, g * f) | 0},${Math.min(255, b * f) | 0})`;
  };
  fill(0, 0, 16, 16, sp.base);
  for (let i = 0; i < 40; i++) fill(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, shade(sp.base, 0.9 + rng() * 0.2));
  if (sp.pattern === 'patches') for (let i = 0; i < 4; i++) fill(Math.floor(rng() * 12), Math.floor(rng() * 12), 3 + Math.floor(rng() * 3), 3 + Math.floor(rng() * 3), sp.second);
  if (sp.pattern === 'stripes') for (let x = 1; x < 16; x += 4) fill(x, 0, 1, 16, sp.second);
  if (sp.pattern === 'fluffy') for (let i = 0; i < 60; i++) fill(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, i % 2 ? '#E0E0E0' : '#FFFFFF');
  if (sp.pattern === 'belly') fill(0, 10, 16, 6, sp.second);
  const headBase = sp.darkHead ? sp.second : sp.base;
  fill(16, 0, 16, 8, headBase);
  fill(24, 0, 8, 8, shade(headBase, 0.92));
  // face: eyes + nose
  fill(17, 2, 2, 2, '#FFFFFF'); fill(21, 2, 2, 2, '#FFFFFF'); fill(18, 3, 1, 1, sp.accent); fill(21, 3, 1, 1, sp.accent);
  if (name === 'pig') fill(18, 5, 4, 2, sp.second);
  else if (name === 'chicken') fill(19, 5, 2, 2, sp.second);
  else fill(19, 6, 2, 1, sp.accent);
  fill(0, 16, 16, 8, name === 'chicken' ? sp.second : sp.darkHead ? sp.second : shade(sp.base, 0.85));
  fill(16, 16, 16, 8, name === 'chicken' ? sp.accent : name === 'rabbit' ? sp.second : sp.second);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return { canvas: cv, texture: t };
}

const R = { body: [0, 0, 16, 16], face: [16, 0, 8, 8], head: [24, 0, 8, 8], legs: [0, 16, 16, 8], extra: [16, 16, 16, 8] };

// Box whose faces sample texture regions (px on the 32x32 sheet). faces: [+x,-x,+y,-y,+z,-z] region names.
function regionBox(w, h, d, faces) {
  const geo = new THREE.BoxGeometry(w * PX, h * PX, d * PX);
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [ru, rv, rw, rh] = R[faces[f]];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      const u = uv.getX(i), vv = uv.getY(i);
      uv.setXY(i, (ru + u * rw) / TEX, (rv + (1 - vv) * rh) / TEX);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export class AnimalManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.animals = [];
    this.textures = new Map();
    this.nextUid = 1;
    this.onChange = null;
    this.max = 30;
  }

  texture(species) {
    if (!this.textures.has(species)) this.textures.set(species, paintSpecies(species, SPECIES[species]));
    return this.textures.get(species);
  }

  build(species) {
    const sp = SPECIES[species];
    const tex = this.texture(species).texture;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    const mk = (geo, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      inner.add(m);
      return m;
    };
    const [bw, bh, bd] = sp.body, [hw, hh, hd] = sp.head, L = sp.legs;
    const legTop = L.h * PX;
    const body = mk(regionBox(bw, bh, bd, ['body', 'body', 'body', 'body', 'body', 'body']), 0, legTop + (bh / 2) * PX, 0);
    // head at the front (-z), slightly above the body top
    const headY = legTop + bh * PX - (hh / 2) * PX + 1 * PX;
    const head = mk(regionBox(hw, hh, hd, ['head', 'head', 'head', 'head', 'head', 'face']), 0, headY, -(bd / 2 + hd / 2 - 1) * PX);
    const legs = [];
    const lw = L.w * PX;
    const offsets = L.n === 2 ? [[-1.5 * PX, 0], [1.5 * PX, 0]] : [[-(bw / 2 - L.w / 2) * PX, -(bd / 2 - L.w / 2) * PX], [(bw / 2 - L.w / 2) * PX, -(bd / 2 - L.w / 2) * PX], [-(bw / 2 - L.w / 2) * PX, (bd / 2 - L.w / 2) * PX], [(bw / 2 - L.w / 2) * PX, (bd / 2 - L.w / 2) * PX]];
    for (const [ox, oz] of offsets) {
      const pivot = new THREE.Group();
      pivot.position.set(ox, legTop, oz);
      const m = new THREE.Mesh(regionBox(L.w, L.h, L.w, ['legs', 'legs', 'legs', 'legs', 'legs', 'legs']), mat);
      m.position.y = -legTop / 2;
      m.castShadow = true;
      pivot.add(m);
      inner.add(pivot);
      legs.push(pivot);
    }
    const ex = (w, h, d, x, y, z) => mk(regionBox(w, h, d, ['extra', 'extra', 'extra', 'extra', 'extra', 'extra']), x, y, z);
    const E = sp.extras;
    if (E.includes('beak')) ex(2, 1, 2, 0, headY - 1 * PX, -(bd / 2 + hd - 0.5) * PX);
    if (E.includes('comb')) ex(1, 2, 3, 0, headY + (hh / 2 + 1) * PX, -(bd / 2 + hd / 2 - 1) * PX);
    if (E.includes('wings')) { ex(1, 4, 6, -(bw / 2 + 0.5) * PX, legTop + (bh / 2) * PX, 0); ex(1, 4, 6, (bw / 2 + 0.5) * PX, legTop + (bh / 2) * PX, 0); }
    if (E.includes('horns')) { ex(1, 2, 1, -(hw / 2 - 0.5) * PX, headY + (hh / 2 + 1) * PX, -(bd / 2 + hd / 2 - 1) * PX); ex(1, 2, 1, (hw / 2 - 0.5) * PX, headY + (hh / 2 + 1) * PX, -(bd / 2 + hd / 2 - 1) * PX); }
    if (E.includes('snout')) ex(4, 3, 1, 0, headY - 1 * PX, -(bd / 2 + hd - 0.5) * PX);
    if (E.includes('tail')) ex(1, 1, 3, 0, legTop + (bh - 1) * PX, (bd / 2 + 1) * PX);
    if (E.includes('ears')) { ex(2, 2, 1, -(hw / 2 - 1) * PX, headY + (hh / 2 + 1) * PX, -(bd / 2 + hd / 2 - 1) * PX); ex(2, 2, 1, (hw / 2 - 1) * PX, headY + (hh / 2 + 1) * PX, -(bd / 2 + hd / 2 - 1) * PX); }
    if (E.includes('longears')) { ex(1, 5, 2, -1 * PX, headY + (hh / 2 + 2) * PX, -(bd / 2 + hd / 2 - 1) * PX); ex(1, 5, 2, 1 * PX, headY + (hh / 2 + 2) * PX, -(bd / 2 + hd / 2 - 1) * PX); }
    if (E.includes('mane')) ex(2, 3, 8, 0, legTop + (bh + 1) * PX, -(bd / 2 - 3) * PX);
    const height = (L.h + bh + 2) * PX, width = Math.max(bw, hw) * PX, depth = (bd + hd) * PX;
    return { group: g, inner, body, head, legs, height, width, depth };
  }

  spawn(species, x, y, z, home) {
    if (!SPECIES[species] || this.animals.length >= this.max) return null;
    const model = this.build(species);
    const a = {
      uid: this.nextUid++, species, x, y, z, hx: home?.x ?? x, hz: home?.z ?? z, yaw: Math.random() * Math.PI * 2,
      state: 'idle', timer: 1 + Math.random() * 2, tx: x, tz: z, phase: Math.random() * 6, bump: 0, ...model,
    };
    a.group.position.set(x, y, z);
    this.scene.add(a.group);
    this.animals.push(a);
    this.onChange?.();
    return a;
  }

  remove(a) {
    this.scene.remove(a.group);
    a.group.traverse((o) => o.geometry?.dispose());
    this.animals = this.animals.filter((b) => b !== a);
    this.onChange?.();
  }

  groundAt(x, z) {
    const W = this.world;
    for (let y = W.height - 1; y >= 0; y--) {
      const id = W.getBlock(x, y, z);
      if (LIQUID[id]) return -100;
      if (SOLID[id] && id !== GHOST) return y;
    }
    return -100;
  }

  update(dt, player) {
    const W = this.world;
    for (const a of this.animals) {
      const sp = SPECIES[a.species];
      a.timer -= dt;
      if (a.state === 'idle') {
        if (a.timer <= 0) {
          const ang = Math.random() * Math.PI * 2, dist = 2 + Math.random() * 6;
          a.tx = Math.max(1.5, Math.min(W.sizeX - 1.5, a.hx + Math.cos(ang) * dist));
          a.tz = Math.max(1.5, Math.min(W.sizeZ - 1.5, a.hz + Math.sin(ang) * dist));
          a.state = 'walk';
          a.timer = 8;
        }
      } else {
        const dx = a.tx - a.x, dz = a.tz - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3 || a.timer <= 0) {
          a.state = 'idle';
          a.timer = 1 + Math.random() * 3;
        } else {
          const step = Math.min(d, sp.speed * dt);
          const nx = a.x + (dx / d) * step, nz = a.z + (dz / d) * step;
          const gy = this.groundAt(Math.floor(nx), Math.floor(nz)) + 1;
          if (Math.abs(gy - a.y) > 1.05 || gy < 1) {
            a.state = 'idle';
            a.timer = 0.5 + Math.random();
          } else {
            a.x = nx; a.z = nz;
            a.y += (gy - a.y) * Math.min(1, dt * 10);
            const wantYaw = Math.atan2(-dx, -dz);
            let dy = wantYaw - a.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            a.yaw += dy * Math.min(1, dt * 6);
          }
        }
      }
      // sink check when the ground changed under a standing animal
      if (a.state === 'idle') {
        const gy = this.groundAt(Math.floor(a.x), Math.floor(a.z)) + 1;
        if (gy >= 1 && Math.abs(gy - a.y) <= 2) a.y += (gy - a.y) * Math.min(1, dt * 6);
      }
      const walking = a.state === 'walk';
      a.phase += dt * (walking ? 9 : 2);
      const swing = walking ? Math.sin(a.phase) * 0.7 : 0;
      a.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? -swing : swing) * (i < 2 ? 1 : -1); });
      a.head.rotation.x = walking ? 0 : Math.sin(a.phase * 0.7) * 0.12 + (a.species === 'chicken' && Math.sin(a.phase) > 0.9 ? 0.6 : 0);
      const hop = sp.hop && walking ? Math.abs(Math.sin(a.phase * 0.5)) * 0.25 : 0;
      a.bump = Math.max(0, a.bump - dt * 3);
      a.group.position.set(a.x, a.y + hop, a.z);
      a.group.rotation.y = a.yaw;
      a.inner.scale.set(1 + a.bump * 0.15, 1 + a.bump * 0.35, 1 + a.bump * 0.15);
    }
  }

  // Nearest animal hit by a ray (slab test against each AABB).
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null, bestT = maxDist;
    for (const a of this.animals) {
      const hx = a.width / 2 + 0.1, hz = a.depth / 2 + 0.1;
      const t = rayBox(ox, oy, oz, dx, dy, dz, a.x - hx, a.y, a.z - hz, a.x + hx, a.y + a.height, a.z + hz);
      if (t !== null && t < bestT) { bestT = t; best = a; }
    }
    return best ? { animal: best, dist: bestT } : null;
  }

  serialize() {
    return { version: 1, nextUid: this.nextUid, animals: this.animals.map((a) => ({ uid: a.uid, species: a.species, x: a.x, y: a.y, z: a.z, hx: a.hx, hz: a.hz })) };
  }

  load(data) {
    if (!data || !Array.isArray(data.animals)) return;
    for (const r of data.animals) {
      const a = this.spawn(r.species, r.x, r.y, r.z, { x: r.hx, z: r.hz });
      if (a) a.uid = r.uid;
    }
    this.nextUid = Math.max(data.nextUid || 1, ...this.animals.map((a) => a.uid + 1), 1);
  }
}

export function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = Infinity;
  const axes = [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
