import { gsap } from 'gsap';
import { iconSVG } from './icons.js';

// Icon-only first-time hints: joystick, look, tap, build. One at a time, looping animation.
export function createHints(container) {
  const el = document.createElement('div');
  el.id = 'hint';
  el.style.display = 'none';
  container.appendChild(el);
  let current = null, tween = null, ringTarget = null;

  function place(name, anchor) {
    const W = window.innerWidth, H = window.innerHeight;
    if (name === 'joystick') return { x: W * 0.22, y: H * 0.62 };
    if (name === 'look') return { x: W * 0.72, y: H * 0.42 };
    if (name === 'tap') return { x: W * 0.5, y: H * 0.4 };
    if (name === 'build' && anchor) return { x: anchor.left - 70, y: anchor.top + anchor.height / 2 };
    return { x: W * 0.5, y: H * 0.5 };
  }

  function show(name, anchorEl = null) {
    if (current === name) return;
    hide(true);
    current = name;
    const anchor = anchorEl ? anchorEl.getBoundingClientRect() : null;
    const p = place(name, anchor);
    el.innerHTML = name === 'look' ? iconSVG('hand', 64) + iconSVG('swipe', 40)
      : name === 'joystick' ? iconSVG('hand', 64) + iconSVG('arrows', 40)
      : name === 'build' ? iconSVG('hand', 64) + iconSVG('arrowUp', 40)
      : iconSVG('hand', 64);
    el.style.display = '';
    gsap.set(el, { left: p.x, top: p.y, xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: name === 'build' ? 90 : 0, scale: 1, opacity: 0 });
    gsap.to(el, { opacity: 1, duration: 0.3 });
    const hand = el.querySelector('.icon');
    if (name === 'joystick') tween = gsap.to(hand, { x: 18, y: -14, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    else if (name === 'look') tween = gsap.to(hand, { x: 40, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    else if (name === 'tap') tween = gsap.to(hand, { y: 14, scale: 0.85, duration: 0.35, yoyo: true, repeat: -1, ease: 'power1.inOut' });
    else tween = gsap.to(hand, { y: 14, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    if (name === 'build' && anchorEl) { ringTarget = anchorEl; anchorEl.classList.add('pulse'); }
  }

  function hide(immediate = false) {
    if (!current) return;
    current = null;
    tween?.kill();
    tween = null;
    if (ringTarget) { ringTarget.classList.remove('pulse'); ringTarget = null; }
    if (immediate) { el.style.display = 'none'; return; }
    gsap.to(el, { opacity: 0, scale: 0.6, duration: 0.25, ease: 'power2.in', onComplete: () => (el.style.display = 'none') });
  }

  return { show, hide, get current() { return current; } };
}
