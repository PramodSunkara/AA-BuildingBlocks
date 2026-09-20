import { SOLID, LIQUID } from '../data/blocks.js';
import { CONFIG } from '../config.js';

const DEG = Math.PI / 180;
const EPS = 0.001;

export class PlayerController {
  constructor(world) {
    this.world = world;
    this.cfg = CONFIG.player;
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0;
    this.pitch = CONFIG.camera.defaultPitch * DEG;
    this.onGround = false;
    this.flying = false;
    this.sprinting = false;
    this.sprintKey = false;
    this.move = { x: 0, y: 0 };
    this.jumpHeld = false;
    this.descendHeld = false;
    this.jumpQueued = 0;
    this.forwardHeldMs = 0;
    this.stepOffset = 0; // visual smoothing after an auto-step
    this.speedNorm = 0;
    this.moving = false;
    this.moveYaw = 0;
    this.distanceWalked = 0;
    this.landed = false;
    this.inWater = false;
    this.eyeInWater = false;
  }

  setPosition(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    this.vx = this.vy = this.vz = 0;
  }

  requestJump() {
    this.jumpQueued = 0.12;
  }

  toggleFly() {
    this.flying = !this.flying;
    this.vy = 0;
    this.onGround = false;
    return this.flying;
  }

  look(dxPx, dyPx, degPerPx) {
    this.yaw -= dxPx * degPerPx * DEG;
    this.pitch -= dyPx * degPerPx * DEG;
    const m = CONFIG.camera.pitchMax * DEG;
    if (this.pitch > m) this.pitch = m;
    if (this.pitch < -m) this.pitch = -m;
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  eye() {
    return { x: this.x, y: this.y + this.cfg.eyeHeight + this.stepOffset, z: this.z };
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  collides(minx, miny, minz, maxx, maxy, maxz) {
    const w = this.world;
    const x0 = Math.floor(minx), x1 = Math.floor(maxx);
    const y0 = Math.floor(miny), y1 = Math.floor(maxy);
    const z0 = Math.floor(minz), z1 = Math.floor(maxz);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (SOLID[w.getBlock(x, y, z)]) return true;
    }
    return false;
  }

  // Does the player's box overlap voxel cell (x,y,z)?
  overlapsCell(cx, cy, cz) {
    const hw = this.cfg.width / 2;
    return cx + 1 > this.x - hw && cx < this.x + hw && cy + 1 > this.y && cy < this.y + this.cfg.height && cz + 1 > this.z - hw && cz < this.z + hw;
  }

  boxAt(x, y, z) {
    const hw = this.cfg.width / 2, h = this.cfg.height;
    return [x - hw, y, z - hw, x + hw - EPS, y + h - EPS, z + hw - EPS];
  }

  tryMoveHorizontal(dx, dz) {
    const c = this.cfg;
    const hw = c.width / 2;
    const stepOK = c.autoStep && (this.onGround || this.inWater) && !this.flying;
    // X axis
    if (dx !== 0) {
      const nx = this.x + dx;
      const b = this.boxAt(nx, this.y, this.z);
      if (!this.collides(...b)) this.x = nx;
      else if (stepOK && this.tryStep(nx, this.z)) { /* stepped */ }
      else {
        this.x = dx > 0 ? Math.floor(nx + hw) - hw - EPS : Math.ceil(nx - hw) + hw + EPS;
        if (this.collides(...this.boxAt(this.x, this.y, this.z))) this.x = nx - dx;
        this.vx = 0;
      }
    }
    // Z axis
    if (dz !== 0) {
      const nz = this.z + dz;
      const b = this.boxAt(this.x, this.y, nz);
      if (!this.collides(...b)) this.z = nz;
      else if (stepOK && this.tryStep(this.x, nz)) { /* stepped */ }
      else {
        this.z = dz > 0 ? Math.floor(nz + hw) - hw - EPS : Math.ceil(nz - hw) + hw + EPS;
        if (this.collides(...this.boxAt(this.x, this.y, this.z))) this.z = nz - dz;
        this.vz = 0;
      }
    }
  }

  // Auto-step: climb exactly one block if there is room above and at the destination.
  tryStep(nx, nz) {
    const ny = this.y + 1;
    if (this.collides(...this.boxAt(this.x, ny, this.z))) return false;
    if (this.collides(...this.boxAt(nx, ny, nz))) return false;
    this.x = nx; this.z = nz; this.y = ny;
    this.stepOffset -= 1;
    return true;
  }

  moveVertical(dy) {
    if (dy === 0) return;
    const c = this.cfg;
    const ny = this.y + dy;
    const b = this.boxAt(this.x, ny, this.z);
    if (!this.collides(...b)) {
      this.y = ny;
      return;
    }
    if (dy < 0) {
      this.y = Math.floor(ny) + 1;
      if (!this.onGround && !this.flying && this.vy < -6) this.landed = true;
      this.onGround = true;
      this.vy = 0;
    } else {
      this.y = Math.floor(ny + c.height) - c.height - EPS;
      this.vy = 0;
    }
  }

  update(dt) {
    const c = this.cfg;
    const W = this.world;
    this.landed = false;

    // sprint: hold forward for 3 s
    if (this.move.y > 0.7) this.forwardHeldMs += dt * 1000;
    else this.forwardHeldMs = 0;
    if (this.forwardHeldMs >= c.sprintHoldMs) this.sprinting = true;
    if (this.move.y < 0.3) this.sprinting = false;
    const sprint = this.sprinting || this.sprintKey;

    const fx0 = Math.floor(this.x), fz0 = Math.floor(this.z);
    this.inWater = !!LIQUID[W.getBlock(fx0, Math.floor(this.y + 0.4), fz0)];
    this.eyeInWater = !!LIQUID[W.getBlock(fx0, Math.floor(this.y + c.eyeHeight), fz0)];
    const speed = (this.flying ? c.flySpeed : c.walkSpeed) * (sprint ? c.sprintMultiplier : 1) * (this.inWater && !this.flying ? 0.55 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * this.move.y + rx * this.move.x;
    let wz = fz * this.move.y + rz * this.move.x;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    this.moving = wl > 0.05;
    if (this.moving) this.moveYaw = Math.atan2(-wx, -wz);

    const accel = this.onGround || this.flying ? 16 : 5;
    const k = 1 - Math.exp(-dt * accel);
    this.vx += (wx * speed - this.vx) * k;
    this.vz += (wz * speed - this.vz) * k;

    if (this.flying) {
      const target = (this.jumpHeld ? 1 : 0) - (this.descendHeld ? 1 : 0);
      this.vy += (target * c.flyVerticalSpeed - this.vy) * (1 - Math.exp(-dt * 12));
      this.onGround = false;
    } else if (this.inWater) {
      // swimming: gentle sink, hold jump to swim up
      this.vy -= 6 * dt;
      if (this.vy < -2.5) this.vy = -2.5;
      if (this.jumpHeld || this.jumpQueued > 0) {
        this.vy += (3.2 - this.vy) * (1 - Math.exp(-dt * 6));
        this.jumpQueued = 0;
      }
      this.onGround = false;
    } else {
      this.vy -= c.gravity * dt;
      if (this.vy < -40) this.vy = -40;
      if (this.jumpQueued > 0 && this.onGround) {
        this.vy = Math.sqrt(2 * c.gravity * c.jumpHeight);
        this.onGround = false;
        this.jumpQueued = 0;
      }
    }
    this.jumpQueued -= dt;

    const wasOnGround = this.onGround;
    if (!this.flying) this.onGround = false;
    this.moveVertical(this.vy * dt);
    if (this.flying && Math.abs(this.vy) < 0.01) this.onGround = wasOnGround;
    // keep the ground flag for step-up decisions when standing still
    if (!this.flying && !this.onGround && wasOnGround && this.vy <= 0) {
      // probe just below the feet
      const b = this.boxAt(this.x, this.y - 0.05, this.z);
      if (this.collides(...b)) this.onGround = true;
    }
    this.tryMoveHorizontal(this.vx * dt, this.vz * dt);

    // village bounds (invisible walls)
    const hw = c.width / 2;
    if (this.x < hw) { this.x = hw; this.vx = 0; }
    if (this.z < hw) { this.z = hw; this.vz = 0; }
    if (this.x > W.sizeX - hw) { this.x = W.sizeX - hw; this.vx = 0; }
    if (this.z > W.sizeZ - hw) { this.z = W.sizeZ - hw; this.vz = 0; }
    if (this.y < 1) { this.y = 1; this.vy = 0; this.onGround = true; }
    if (this.y > W.height - c.height - 1) { this.y = W.height - c.height - 1; this.vy = Math.min(0, this.vy); }

    this.stepOffset += (0 - this.stepOffset) * (1 - Math.exp(-dt * 16));
    const hs = Math.hypot(this.vx, this.vz);
    this.speedNorm = hs / c.walkSpeed;
    if (this.onGround) this.distanceWalked += hs * dt;
  }
}
