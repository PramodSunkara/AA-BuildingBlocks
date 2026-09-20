import * as THREE from 'three';
import { LAYOUT, regions } from './skin.js';

const PX = 1 / 16;

// A box whose faces sample the six regions of a skin part. Faces: +x,-x,+y,-y,+z,-z.
function skinBox(L) {
  const geo = new THREE.BoxGeometry(L.w * PX, L.h * PX, L.d * PX);
  const R = regions(L);
  const faceRegion = [R.left, R.right, R.top, R.bottom, R.back, R.front]; // avatar faces -z
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [ru, rv, rw, rh] = faceRegion[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      const u = uv.getX(i), vv = uv.getY(i);
      uv.setXY(i, (ru + u * rw) / 64, (rv + (1 - vv) * rh) / 64);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export class Avatar {
  constructor(skinTexture) {
    this.group = new THREE.Group();
    this.material = new THREE.MeshLambertMaterial({ map: skinTexture });
    this.inner = new THREE.Group();
    this.inner.scale.setScalar(0.9); // 2.0 model units -> 1.8 blocks
    this.group.add(this.inner);

    const mk = (L, px, py, pz, pivotY) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, pivotY, pz);
      const mesh = new THREE.Mesh(skinBox(L), this.material);
      mesh.position.set(0, py - pivotY, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      pivot.add(mesh);
      this.inner.add(pivot);
      return pivot;
    };
    // model units: legs 0..0.75, body 0.75..1.5, head 1.5..2.0
    this.legR = mk(LAYOUT.legR, -0.125, 0.375, 0, 0.75);
    this.legL = mk(LAYOUT.legL, 0.125, 0.375, 0, 0.75);
    this.body = mk(LAYOUT.body, 0, 1.125, 0, 0.75);
    this.armR = mk(LAYOUT.armR, -0.375, 1.125, 0, 1.4);
    this.armL = mk(LAYOUT.armL, 0.375, 1.125, 0, 1.4);
    this.head = mk(LAYOUT.head, 0, 1.75, 0, 1.5);

    this.phase = 0;
    this.time = 0;
    this.bodyYaw = 0;
    this.airT = 0;
  }

  setSkin(texture) {
    this.material.map = texture;
    this.material.needsUpdate = true;
  }

  // speed: 0..1.6 (normalised to walk speed). lookYaw/pitch in radians.
  update(dt, { x, y, z, speed, onGround, flying, lookYaw, lookPitch, moving, moveYaw, wave = false }) {
    this.time += dt;
    this.group.position.set(x, y, z);

    // body turns toward movement direction, or slowly toward the look direction when idle
    const targetYaw = moving ? moveYaw : lookYaw;
    let d = targetYaw - this.bodyYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const turn = 1 - Math.exp(-dt * (moving ? 14 : 4));
    this.bodyYaw += d * turn;
    this.group.rotation.y = this.bodyYaw;

    // head follows the look direction (clamped)
    let hy = lookYaw - this.bodyYaw;
    hy = Math.atan2(Math.sin(hy), Math.cos(hy));
    hy = Math.max(-1.1, Math.min(1.1, hy));
    this.head.rotation.y += (hy - this.head.rotation.y) * (1 - Math.exp(-dt * 12));
    this.head.rotation.x += (-lookPitch * 0.6 - this.head.rotation.x) * (1 - Math.exp(-dt * 12));

    const s = Math.min(speed, 1.6);
    this.phase += dt * (6 + 5 * s) * Math.min(1, s * 2);
    const swing = Math.sin(this.phase) * 0.9 * Math.min(1, s);

    this.airT = onGround && !flying ? Math.max(0, this.airT - dt * 6) : Math.min(1, this.airT + dt * 8);
    const air = this.airT;

    // legs / arms swing while walking, tuck while airborne
    this.legR.rotation.x = swing * (1 - air) + 0.35 * air;
    this.legL.rotation.x = -swing * (1 - air) - 0.15 * air;
    this.armR.rotation.x = -swing * (1 - air);
    this.armL.rotation.x = swing * (1 - air);
    this.armR.rotation.z = 0.08 + (flying ? 2.6 : 1.6) * air;
    this.armL.rotation.z = -0.08 - (flying ? 2.6 : 1.6) * air;
    if (wave) {
      this.armR.rotation.x = 0;
      this.armR.rotation.z = 2.7 + Math.sin(this.time * 14) * 0.45;
    }

    // idle bob and breathing
    const idle = 1 - Math.min(1, s * 3);
    const bob = Math.sin(this.time * 2.2) * 0.012 * idle + Math.abs(Math.sin(this.phase)) * 0.03 * Math.min(1, s);
    this.inner.position.y = bob;
    this.body.rotation.x = 0.04 * Math.min(1, s);
  }
}
