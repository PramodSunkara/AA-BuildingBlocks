import * as THREE from 'three';
import { BLOCKS, CHANDELIER } from '../data/blocks.js';
import { CH, CY } from '../world/chunk.js';

// Point lights for torches/chandeliers: a fixed pool (constant light count keeps shaders stable),
// assigned to the nearest light-emitting blocks every quarter second.
export class TorchLights {
  constructor(scene, world, max = 8) {
    this.world = world;
    this.max = max;
    this.pool = [];
    for (let i = 0; i < max; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 9, 2);
      l.position.set(0, -50, 0);
      scene.add(l);
      this.pool.push(l);
    }
    this.sources = new Map(); // key -> [x, y, z]
    this.acc = 1;
  }

  scan() {
    this.sources.clear();
    const W = this.world;
    for (const c of W.chunks) {
      const d = c.data;
      for (let i = 0; i < d.length; i++) {
        const b = BLOCKS[d[i]];
        if (!b || !b.light) continue;
        const x = i % CH, z = Math.floor(i / CH) % CH, y = Math.floor(i / (CH * CH));
        this.add(c.cx * CH + x, y, c.cz * CH + z, d[i]);
      }
    }
  }

  add(x, y, z, id) {
    this.sources.set(`${x},${y},${z}`, [x + 0.5, y + (id === CHANDELIER ? 0.55 : 0.75), z + 0.5]);
  }

  onBlockChanged(x, y, z, id) {
    const b = BLOCKS[id];
    if (b && b.light) this.add(x, y, z, id);
    else this.sources.delete(`${x},${y},${z}`);
    this.acc = 1;
  }

  update(dt, px, py, pz, intensity = 9) {
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    const near = [];
    for (const p of this.sources.values()) {
      const d = (p[0] - px) ** 2 + (p[1] - py) ** 2 + (p[2] - pz) ** 2;
      if (d < 40 * 40) near.push([d, p]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.max; i++) {
      const l = this.pool[i];
      if (i < near.length) {
        const p = near[i][1];
        l.position.set(p[0], p[1], p[2]);
        l.intensity = intensity;
      } else {
        l.intensity = 0;
        l.position.set(0, -50, 0);
      }
    }
  }

  get count() {
    return this.sources.size;
  }
}
