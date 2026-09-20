import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Pooled cube particles in one InstancedMesh (one draw call).
export class Particles {
  constructor(scene, max = 320) {
    this.max = max;
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, c);
    scene.add(this.mesh);
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.alive = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this._zero);
    this._color = new THREE.Color();
  }

  burst(x, y, z, rgb, count) {
    let placed = 0;
    for (let i = 0; i < this.max && placed < count; i++) {
      if (this.life[i] > 0) continue;
      const j = i * 3;
      this.pos[j] = x + 0.15 + Math.random() * 0.7;
      this.pos[j + 1] = y + 0.15 + Math.random() * 0.7;
      this.pos[j + 2] = z + 0.15 + Math.random() * 0.7;
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
      this.vel[j] = Math.cos(a) * s;
      this.vel[j + 1] = 2.5 + Math.random() * 3;
      this.vel[j + 2] = Math.sin(a) * s;
      this.rot[j] = Math.random() * 6.28;
      this.rot[j + 1] = Math.random() * 6.28;
      this.rot[j + 2] = Math.random() * 6.28;
      this.life[i] = this.maxLife[i] = CONFIG.particles.life * (0.8 + Math.random() * 0.4);
      const v = 0.85 + Math.random() * 0.3;
      this._color.setRGB(rgb[0] * v, rgb[1] * v, rgb[2] * v, THREE.SRGBColorSpace);
      this.mesh.setColorAt(i, this._color);
      placed++;
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const g = CONFIG.particles.gravity;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      const j = i * 3;
      this.life[i] -= dt;
      this.vel[j + 1] -= g * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.rot[j] += dt * 4;
      this.rot[j + 2] += dt * 3;
      if (this.life[i] <= 0) {
        this.mesh.setMatrixAt(i, this._zero);
        continue;
      }
      const f = this.life[i] / this.maxLife[i];
      const s = f < 0.3 ? f / 0.3 : 1;
      this._e.set(this.rot[j], this.rot[j + 1], this.rot[j + 2]);
      this._q.setFromEuler(this._e);
      this._s.set(s, s, s);
      this._p.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
