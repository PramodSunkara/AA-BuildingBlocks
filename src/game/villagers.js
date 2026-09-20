import { Avatar } from '../player/avatar.js';
import { paintSkin } from '../player/skin.js';
import { SOLID, GHOST, LIQUID } from '../data/blocks.js';
import { rayBox } from './animals.js';

export const VILLAGER_SKINS = [
  { shirt: '#D9403A', trousers: '#2A2A2A', hair: '#3B2A1A', skin: '#F1C9A5' },
  { shirt: '#3FA34D', trousers: '#7A4B2A', hair: '#1E1E1E', skin: '#E8B98F' },
  { shirt: '#8A4FC8', trousers: '#3A6FD8', hair: '#F2C230', skin: '#F1C9A5' },
  { shirt: '#F08A2A', trousers: '#2B4A9E', hair: '#5C3F22', skin: '#C68642' },
  { shirt: '#F08AB8', trousers: '#F2F2F2', hair: '#1E1E1E', skin: '#8D5524' },
  { shirt: '#9CC8F0', trousers: '#2A2A2A', hair: '#D9403A', skin: '#F1C9A5' },
  { shirt: '#F2C230', trousers: '#3FA34D', hair: '#3B2A1A', skin: '#E0AC69' },
  { shirt: '#F2F2F2', trousers: '#8A4FC8', hair: '#F2F2F2', skin: '#C68642' },
];
const EMOJI = ['👋', '😊', '🏠', '🌻', '⭐', '🎉', '❤️', '🐔'];
export const MAX_VILLAGERS = 12;

// Villagers wander near buildings, wave and say an emoji when the player comes within 3 blocks.
export class VillagerManager {
  constructor(scene, world, buildings) {
    this.scene = scene;
    this.world = world;
    this.buildings = buildings;
    this.villagers = [];
    this.skins = new Map();
    this.onChange = null;
  }

  skin(i) {
    if (!this.skins.has(i)) this.skins.set(i, paintSkin(VILLAGER_SKINS[i % VILLAGER_SKINS.length]));
    return this.skins.get(i);
  }

  add(skinIndex, x, z) {
    if (this.villagers.length >= MAX_VILLAGERS) return null;
    const avatar = new Avatar(this.skin(skinIndex).texture);
    const y = this.groundAt(Math.floor(x), Math.floor(z)) + 1;
    const v = { skinIndex, x, y: y > 0 ? y : 20, z, yaw: Math.random() * 6.28, avatar, state: 'idle', timer: 1 + Math.random() * 2, tx: x, tz: z, waveT: 0, cooldown: 0, bubble: null, speed: 0 };
    this.scene.add(avatar.group);
    this.villagers.push(v);
    this.onChange?.();
    return v;
  }

  // Keep the population equal to the number of level-ups across profiles (capped).
  ensureCount(n, spawn) {
    while (this.villagers.length < Math.min(n, MAX_VILLAGERS)) {
      const i = this.villagers.length;
      const p = spawn ? spawn(i) : { x: 64.5, z: 64.5 };
      this.add(i % VILLAGER_SKINS.length, p.x, p.z);
    }
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

  pickTarget(v) {
    const W = this.world;
    const list = this.buildings.instances;
    let cx = 64.5, cz = 64.5, spread = 10;
    if (list.length && Math.random() < 0.8) {
      const inst = list[Math.floor(Math.random() * list.length)];
      const b = this.buildings.bbox(inst);
      // a point on a ring 1..4 blocks outside the building footprint
      const side = Math.floor(Math.random() * 4), off = 1.5 + Math.random() * 3;
      if (side === 0) { cx = b.x0 - off; cz = b.z0 + Math.random() * (b.z1 - b.z0); }
      else if (side === 1) { cx = b.x1 + off; cz = b.z0 + Math.random() * (b.z1 - b.z0); }
      else if (side === 2) { cz = b.z0 - off; cx = b.x0 + Math.random() * (b.x1 - b.x0); }
      else { cz = b.z1 + off; cx = b.x0 + Math.random() * (b.x1 - b.x0); }
      spread = 0;
    }
    const ang = Math.random() * 6.28, d = Math.random() * spread;
    v.tx = Math.max(1.5, Math.min(W.sizeX - 1.5, cx + Math.cos(ang) * d));
    v.tz = Math.max(1.5, Math.min(W.sizeZ - 1.5, cz + Math.sin(ang) * d));
  }

  update(dt, player, sayBubble) {
    for (const v of this.villagers) {
      v.timer -= dt;
      v.cooldown = Math.max(0, v.cooldown - dt);
      const pdx = player.x - v.x, pdz = player.z - v.z;
      const pd = Math.hypot(pdx, pdz);
      let moving = false;
      if (pd < 3 && v.cooldown === 0) {
        v.waveT = 2.2;
        v.cooldown = 8;
        v.state = 'idle';
        v.timer = 2.5;
        sayBubble?.(v, EMOJI[Math.floor(Math.random() * EMOJI.length)]);
      }
      if (v.waveT > 0) {
        v.waveT -= dt;
        // face the player
        const want = Math.atan2(-pdx, -pdz);
        let dy = want - v.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        v.yaw += dy * Math.min(1, dt * 8);
      } else if (v.state === 'idle') {
        if (v.timer <= 0) { this.pickTarget(v); v.state = 'walk'; v.timer = 12; }
      } else {
        const dx = v.tx - v.x, dz = v.tz - v.z, d = Math.hypot(dx, dz);
        if (d < 0.35 || v.timer <= 0) { v.state = 'idle'; v.timer = 1.5 + Math.random() * 3; }
        else {
          const step = Math.min(d, 1.7 * dt);
          const nx = v.x + (dx / d) * step, nz = v.z + (dz / d) * step;
          const gy = this.groundAt(Math.floor(nx), Math.floor(nz)) + 1;
          if (Math.abs(gy - v.y) > 1.05 || gy < 1) { v.state = 'idle'; v.timer = 0.5 + Math.random(); }
          else {
            v.x = nx; v.z = nz;
            v.y += (gy - v.y) * Math.min(1, dt * 10);
            v.yaw = Math.atan2(-dx, -dz);
            moving = true;
          }
        }
      }
      v.speed += ((moving ? 0.4 : 0) - v.speed) * Math.min(1, dt * 8);
      v.avatar.update(dt, {
        x: v.x, y: v.y, z: v.z, speed: v.speed, onGround: true, flying: false,
        lookYaw: v.yaw, lookPitch: 0, moving, moveYaw: v.yaw, wave: v.waveT > 0,
      });
    }
  }

  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null, bestT = maxDist;
    for (const v of this.villagers) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, v.x - 0.4, v.y, v.z - 0.4, v.x + 0.4, v.y + 1.8, v.z + 0.4);
      if (t !== null && t < bestT) { bestT = t; best = v; }
    }
    return best ? { villager: best, dist: bestT } : null;
  }

  serialize() {
    return { version: 1, villagers: this.villagers.map((v) => ({ skinIndex: v.skinIndex, x: v.x, z: v.z })) };
  }

  load(data) {
    if (!data || !Array.isArray(data.villagers)) return;
    for (const r of data.villagers) this.add(r.skinIndex, r.x, r.z);
  }
}
