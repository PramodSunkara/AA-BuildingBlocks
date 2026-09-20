import { CONFIG } from '../config.js';

// Multi-touch dispatch with pointerId tracking.
// Left 40 %: joystick. Right 60 %: first finger drags to look; every finger can tap or long-press.
export function setupTouch({ canvas, joystick, actions }) {
  const I = CONFIG.input;
  const pointers = new Map();
  let joyId = null, lookId = null;

  const width = () => canvas.clientWidth || window.innerWidth;

  function onDown(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const id = e.pointerId;
    if (e.clientX < width() * I.joystickRegion && joyId === null) {
      joyId = id;
      pointers.set(id, { kind: 'joy' });
      joystick.show(e.clientX, e.clientY);
      return;
    }
    const p = {
      kind: 'touch', id, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      t0: performance.now(), moved: false, isLook: lookId === null, holding: false, timer: null,
    };
    if (p.isLook) lookId = id;
    p.timer = setTimeout(() => {
      if (!p.moved && pointers.has(id)) {
        p.holding = true;
        actions.holdStart(id, p.x, p.y);
      }
    }, I.longPressMs);
    pointers.set(id, p);
  }

  function onMove(e) {
    if (e.pointerType === 'mouse') return;
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'joy') {
      joystick.move(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.isLook && (dx !== 0 || dy !== 0)) actions.look(dx, dy);
    if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > I.tapPx) {
      p.moved = true;
      if (!p.holding) clearTimeout(p.timer);
    }
    if (p.holding) actions.holdMove(p.id, p.x, p.y);
  }

  function onUp(e) {
    if (e.pointerType === 'mouse') return;
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    pointers.delete(e.pointerId);
    if (p.kind === 'joy') {
      joyId = null;
      joystick.hide();
      return;
    }
    clearTimeout(p.timer);
    if (p.holding) actions.holdEnd(p.id);
    else if (!p.moved && performance.now() - p.t0 < I.tapMs) actions.tap(p.x, p.y);
    if (lookId === p.id) lookId = null;
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // Kill Safari gestures: pinch zoom, double-tap zoom, scroll, long-press callouts.
  const kill = (e) => e.preventDefault();
  document.addEventListener('gesturestart', kill, { passive: false });
  document.addEventListener('gesturechange', kill, { passive: false });
  document.addEventListener('touchmove', kill, { passive: false });
  canvas.addEventListener('touchstart', kill, { passive: false });
  canvas.addEventListener('touchend', kill, { passive: false });
  document.addEventListener('contextmenu', kill);
  document.addEventListener('dblclick', kill);
  document.addEventListener('selectstart', kill);

  return {
    releaseAll() {
      for (const [id, p] of pointers) {
        if (p.kind === 'joy') joystick.hide();
        else {
          clearTimeout(p.timer);
          if (p.holding) actions.holdEnd(id);
        }
      }
      pointers.clear();
      joyId = null;
      lookId = null;
    },
  };
}
