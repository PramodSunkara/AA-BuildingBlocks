import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createLighting(scene) {
  const R = CONFIG.render;
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a7a3a, R.hemiIntensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dc, R.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(R.shadowMapSize, R.shadowMapSize);
  const half = R.shadowBox / 2;
  const cam = sun.shadow.camera;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = 1;
  cam.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const dir = new THREE.Vector3(...R.sunDirection).normalize();
  const lastSnap = new THREE.Vector3(NaN, NaN, NaN);

  function update(px, py, pz) {
    // Snap the shadow frustum to whole blocks so shadow edges do not swim while walking.
    const sx = Math.floor(px), sy = Math.floor(py), sz = Math.floor(pz);
    if (sx === lastSnap.x && sy === lastSnap.y && sz === lastSnap.z) return;
    lastSnap.set(sx, sy, sz);
    sun.target.position.set(sx, sy, sz);
    sun.position.set(sx + dir.x * 80, sy + dir.y * 80, sz + dir.z * 80);
    sun.target.updateMatrixWorld();
  }

  function setShadows(on) {
    sun.castShadow = on;
  }

  function setSky(skyHex, groundHex) {
    hemi.color.set(skyHex);
    hemi.groundColor.set(groundHex);
  }

  return { hemi, sun, update, setShadows, setSky, sunDir: dir };
}
