import * as THREE from 'three';
import { meshChunk } from './mesher.js';
import { CH } from './chunk.js';

export class ChunkRenderer {
  constructor(world, scene, materials) {
    this.world = world;
    this.scene = scene;
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.name = 'chunks';
    scene.add(this.group);
    this.meshCount = 0;
    this.lastBuildMs = 0;
  }

  buildAll() {
    const t0 = performance.now();
    for (const c of this.world.chunks) {
      this.build(c);
      c.dirty = false;
    }
    this.world.dirtyQueue.length = 0;
    this.lastBuildMs = performance.now() - t0;
  }

  // Re-mesh at most `max` dirty chunks this frame.
  update(max) {
    const q = this.world.dirtyQueue;
    let n = 0;
    while (n < max && q.length) {
      const c = q.shift();
      if (!c.dirty) continue;
      this.build(c);
      c.dirty = false;
      n++;
    }
    return n;
  }

  disposeChunk(c) {
    if (!c.meshes) return;
    for (const m of c.meshes) {
      this.group.remove(m);
      m.geometry.dispose();
      this.meshCount--;
    }
    c.meshes = null;
  }

  build(c) {
    const groups = meshChunk(this.world, c);
    this.disposeChunk(c);
    c.meshes = [];
    for (let g = 0; g < 3; g++) {
      const d = groups[g];
      if (!d) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(d.nrm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(d.col, 3));
      geo.setIndex(new THREE.BufferAttribute(d.idx, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, this.materials[g]);
      mesh.position.set(c.cx * CH, 0, c.cz * CH);
      mesh.castShadow = g !== 2;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.name = `chunk-${c.cx}-${c.cz}-${g}`;
      this.group.add(mesh);
      c.meshes.push(mesh);
      this.meshCount++;
    }
  }

  // Rebuild everything (used after a WebGL context restore).
  rebuildAll() {
    for (const c of this.world.chunks) this.disposeChunk(c);
    this.buildAll();
  }
}
