import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { gsap } from 'gsap';
import { TILE, blockById } from '../data/blocks.js';
import { tileRect } from './atlas.js';

// White wireframe target outline (1.5 px), crack overlay for breaking, and the place "pop" cube.
export class Highlight {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;

    // --- outline ---
    const e = 0.004;
    const c = [
      [-e, -e, -e], [1 + e, -e, -e], [1 + e, -e, 1 + e], [-e, -e, 1 + e],
      [-e, 1 + e, -e], [1 + e, 1 + e, -e], [1 + e, 1 + e, 1 + e], [-e, 1 + e, 1 + e],
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const positions = [];
    for (const [a, b] of edges) positions.push(...c[a], ...c[b]);
    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    this.lineMaterial = new LineMaterial({
      color: 0xffffff, linewidth: 1.5, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false,
    });
    this.outline = new LineSegments2(geo, this.lineMaterial);
    this.outline.visible = false;
    this.outline.renderOrder = 5;
    scene.add(this.outline);
    this.target = null;
    this.time = 0;

    // --- crack overlay ---
    this.crackTextures = [0, 1, 2, 3].map((k) => {
      const src = atlas.tiles[TILE.CRACK_0 + k];
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, 64, 64);
      const t = new THREE.CanvasTexture(cv);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    this.crackMaterial = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), this.crackMaterial);
    this.crack.visible = false;
    this.crack.renderOrder = 4;
    scene.add(this.crack);

    // --- place pop ---
    this.popMaterial = new THREE.MeshLambertMaterial({ map: atlas.texture, transparent: false });
    this.pop = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.popMaterial);
    this.pop.visible = false;
    this.pop.castShadow = false;
    scene.add(this.pop);
    this.popTween = null;
  }

  setResolution(w, h) {
    this.lineMaterial.resolution.set(w, h);
  }

  setTarget(t) {
    this.target = t;
    if (!t) {
      this.outline.visible = false;
      return;
    }
    this.outline.visible = true;
    this.outline.position.set(t.x, t.y, t.z);
  }

  setCrack(t, progress) {
    if (!t || progress <= 0) {
      this.crack.visible = false;
      return;
    }
    const stage = Math.min(3, Math.floor(progress * 4));
    this.crackMaterial.map = this.crackTextures[stage];
    this.crackMaterial.needsUpdate = true;
    const s = 1.004 - 0.06 * progress; // shrinks slightly as the crack deepens
    this.crack.scale.set(s, s, s);
    this.crack.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    this.crack.visible = true;
  }

  // Scale pop 1.0 -> 1.08 -> 1.0 over 120 ms using a cube textured like the placed block.
  playPop(x, y, z, blockId) {
    const block = blockById(blockId);
    const geo = this.pop.geometry;
    const uv = geo.attributes.uv;
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z; 4 vertices each with uv (0,1),(1,1),(0,0),(1,0)
    for (let f = 0; f < 6; f++) {
      const r = tileRect(block.faces[f]);
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        const u = v % 2, vv = v < 2 ? 0 : 1; // top row first (texture v=0 is the top)
        uv.setXY(i, r[0] + u * (r[2] - r[0]), r[1] + vv * (r[3] - r[1]));
      }
    }
    uv.needsUpdate = true;
    this.pop.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.pop.visible = true;
    this.pop.scale.set(1.0, 1.0, 1.0);
    this.popTween?.kill();
    this.popTween = gsap.timeline({ onComplete: () => (this.pop.visible = false) })
      .to(this.pop.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.06, ease: 'power2.out' })
      .to(this.pop.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.06, ease: 'power2.in' });
  }

  update(dt) {
    this.time += dt;
    if (this.outline.visible) {
      const s = 1 + 0.012 * Math.sin(this.time * 6);
      this.outline.scale.set(s, s, s);
      const t = this.target;
      const o = (s - 1) / 2;
      this.outline.position.set(t.x - o, t.y - o, t.z - o);
    }
  }
}
