import { CONFIG } from '../config.js';

// Keyboard + mouse fallback for desktop testing: WASD, Space, Shift, F fly, C camera, 1-6 hotbar,
// F3 debug, mouse-look under pointer lock, LMB hold to break, RMB to place, wheel to change slot.
export function setupDesktop({ canvas, actions }) {
  const keys = new Set();
  let locked = false;
  const HOLD_ID = 'mouse';

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    switch (e.code) {
      case 'Space': actions.jumpDown(); e.preventDefault(); break;
      case 'KeyF': actions.toggleFly(); break;
      case 'KeyC': actions.toggleCamera(); break;
      case 'F3': actions.toggleDebug(); e.preventDefault(); break;
      case 'Escape': actions.escape?.(); break;
      case 'KeyB': actions.build?.(); break;
      case 'Tab': e.preventDefault(); break;
      default:
        if (/^Digit[1-6]$/.test(e.code)) actions.selectSlot(parseInt(e.code[5], 10) - 1);
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'Space') actions.jumpUp();
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (!locked) {
      canvas.requestPointerLock?.()?.catch?.(() => {});
      return;
    }
    const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
    if (e.button === 0) actions.holdStart(HOLD_ID, cx, cy);
    else if (e.button === 2) actions.tap(cx, cy);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) actions.holdEnd(HOLD_ID);
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) actions.holdEnd(HOLD_ID);
  });
  window.addEventListener('mousemove', (e) => {
    if (!locked) return;
    actions.lookMouse(e.movementX, e.movementY);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    actions.cycleSlot(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  function update() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    actions.setKeyboardMove(x, y);
    actions.setSprintKey(keys.has('ShiftLeft') || keys.has('ShiftRight'));
    actions.setDescend(keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyQ'));
  }

  return { update, get locked() { return locked; } };
}
