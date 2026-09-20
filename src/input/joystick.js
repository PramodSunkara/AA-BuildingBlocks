import { CONFIG } from '../config.js';

// Floating joystick: appears where the thumb lands, reports a vector in -1..1 (y up = forward).
export function createJoystick(el, onMove) {
  const I = CONFIG.input;
  const knob = el.querySelector('.knob');
  const R = (I.joystickOuter - I.joystickKnob) / 2; // knob travel radius
  let cx = 0, cy = 0, active = false;
  el.style.width = el.style.height = I.joystickOuter + 'px';
  knob.style.width = knob.style.height = I.joystickKnob + 'px';

  function show(x, y) {
    const half = I.joystickOuter / 2;
    const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    cx = Math.max(half, Math.min(w - half, x));
    cy = Math.max(half, Math.min(h - half, y));
    el.style.transform = `translate(${cx - half}px, ${cy - half}px)`;
    knob.style.transform = 'translate(0px, 0px)';
    el.classList.add('active');
    active = true;
    onMove(0, 0);
  }

  function move(x, y) {
    if (!active) return;
    let dx = x - cx, dy = y - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let vx = dx / R, vy = -dy / R;
    const mag = Math.hypot(vx, vy);
    if (mag < I.joystickDeadZone) { vx = 0; vy = 0; }
    else {
      const m = (mag - I.joystickDeadZone) / (1 - I.joystickDeadZone);
      vx = (vx / mag) * m;
      vy = (vy / mag) * m;
    }
    onMove(vx, vy);
  }

  function hide() {
    active = false;
    el.classList.remove('active');
    onMove(0, 0);
  }

  return { show, move, hide, get active() { return active; } };
}
