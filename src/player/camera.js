import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { raycastVoxels } from '../world/raycast.js';
import { SOLID, LIQUID } from '../data/blocks.js';

// Critically damped spring (Unity-style SmoothDamp) per component.
function smoothDamp(cur, target, vel, smoothTime, dt) {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

export class CameraRig {
  constructor(aspect, world) {
    const C = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(C.fov, aspect, C.near, C.far);
    this.world = world;
    this.mode = 'third';
    this.pos = new THREE.Vector3();
    this.vel = { x: { v: 0 }, y: { v: 0 }, z: { v: 0 } };
    this.init = false;
    this.avatarVisible = true;
    this.collidedDist = C.thirdDistance;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this._solid = (id) => SOLID[id] && !LIQUID[id];
    this.orbit = null;
  }

  // Celebration orbit around a point; the camera glides back afterwards.
  startOrbit(cx, cy, cz, radius, height) {
    const c = this.camera.position;
    this.orbit = { cx, cy, cz, radius, height, angle: Math.atan2(c.z - cz, c.x - cx) };
  }

  stopOrbit() {
    if (!this.orbit) return;
    this.orbit = null;
    this.pos.copy(this.camera.position);
    this.vel.x.v = this.vel.y.v = this.vel.z.v = 0;
    this.init = true;
  }

  toggle() {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    this.init = false;
    return this.mode;
  }

  shake(amp = 0.06, t = 0.12) {
    this.shakeAmp = amp;
    this.shakeT = t;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt, player) {
    const C = CONFIG.camera;
    const cam = this.camera;
    const eye = player.eye();
    const d = player.lookDir();
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const f = this.shakeAmp * (this.shakeT / 0.12);
      sx = (Math.random() * 2 - 1) * f;
      sy = (Math.random() * 2 - 1) * f;
    }

    if (this.orbit) {
      const o = this.orbit;
      o.angle += dt * 0.45;
      cam.position.set(o.cx + Math.cos(o.angle) * o.radius, o.cy + o.height, o.cz + Math.sin(o.angle) * o.radius);
      cam.lookAt(o.cx, o.cy, o.cz);
      this.avatarVisible = true;
      return;
    }

    if (this.mode === 'first') {
      cam.position.set(eye.x + sx, eye.y + sy, eye.z);
      cam.lookAt(eye.x + d.x + sx, eye.y + d.y + sy, eye.z + d.z);
      this.avatarVisible = false;
      return;
    }

    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const px = eye.x + rx * C.thirdSideOffset;
    const py = eye.y + C.thirdPivotAboveEye;
    const pz = eye.z + rz * C.thirdSideOffset;
    const tx = px - d.x * C.thirdDistance, ty = py - d.y * C.thirdDistance, tz = pz - d.z * C.thirdDistance;

    if (!this.init) {
      this.pos.set(tx, ty, tz);
      this.vel.x.v = this.vel.y.v = this.vel.z.v = 0;
      this.init = true;
    } else {
      this.pos.x = smoothDamp(this.pos.x, tx, this.vel.x, C.smoothTime, dt);
      this.pos.y = smoothDamp(this.pos.y, ty, this.vel.y, C.smoothTime, dt);
      this.pos.z = smoothDamp(this.pos.z, tz, this.vel.z, C.smoothTime, dt);
    }

    // pull the camera in front of any terrain between the pivot and the desired position
    let cx = this.pos.x - px, cy = this.pos.y - py, cz = this.pos.z - pz;
    const dist = Math.hypot(cx, cy, cz);
    let fx = this.pos.x, fy = this.pos.y, fz = this.pos.z;
    if (dist > 0.001) {
      cx /= dist; cy /= dist; cz /= dist;
      const hit = raycastVoxels(this.world.getBlock.bind(this.world), px, py, pz, cx, cy, cz, dist, this._solid);
      if (hit) {
        const nd = Math.max(0.3, hit.dist - 0.3);
        fx = px + cx * nd; fy = py + cy * nd; fz = pz + cz * nd;
        this.collidedDist = nd;
      } else this.collidedDist = dist;
    }
    cam.position.set(fx + sx, fy + sy, fz);
    cam.lookAt(px + sx, py + sy, pz);
    this.avatarVisible = this.collidedDist > 1.1;
  }
}
