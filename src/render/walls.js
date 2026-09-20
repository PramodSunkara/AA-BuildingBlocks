import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Soft translucent blue walls at the village edge; fade in when the player is within 3 blocks.
export function createEdgeWalls(scene) {
  const W = CONFIG.world;
  const mat = () => new THREE.MeshBasicMaterial({
    color: 0x9cc8f0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const walls = [];
  const mk = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat());
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.visible = false;
    scene.add(m);
    walls.push(m);
    return m;
  };
  const h = W.height, midY = h / 2;
  mk(W.sizeX, h, W.sizeX / 2, midY, 0, 0);
  mk(W.sizeX, h, W.sizeX / 2, midY, W.sizeZ, 0);
  mk(W.sizeZ, h, 0, midY, W.sizeZ / 2, Math.PI / 2);
  mk(W.sizeZ, h, W.sizeX, midY, W.sizeZ / 2, Math.PI / 2);

  function update(px, pz) {
    const fd = W.wallFadeDistance;
    const d = [pz, W.sizeZ - pz, px, W.sizeX - px];
    for (let i = 0; i < 4; i++) {
      const a = Math.max(0, 1 - d[i] / fd) * 0.35;
      walls[i].material.opacity = a;
      walls[i].visible = a > 0.005;
    }
  }
  return { update };
}
