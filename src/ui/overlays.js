import { gsap } from 'gsap';
import { iconSVG } from './icons.js';
import { CONFIG } from '../config.js';

// Celebration (vignette, confetti, banner, rewards), level-up banner, remove dialog, gem fly-in.
export function createOverlays(container) {
  const vignette = document.createElement('div');
  vignette.id = 'vignette';
  const confetti = document.createElement('div');
  confetti.id = 'confetti';
  const banner = document.createElement('div');
  banner.id = 'celebration';
  banner.style.display = 'none';
  banner.innerHTML = '<div class="cel-title"></div><div class="cel-rewards"><span class="cel-xp"></span><span class="cel-gems"></span></div><div class="cel-hint">tap</div>';
  const levelEl = document.createElement('div');
  levelEl.id = 'levelup';
  levelEl.style.display = 'none';
  const dialog = document.createElement('div');
  dialog.className = 'overlay';
  dialog.id = 'dialog';
  dialog.style.display = 'none';
  dialog.innerHTML = `<div class="dialog panel"><div class="dialog-text">Remove the whole building?</div>
    <div class="dialog-buttons"><div class="btn panel big confirm" id="dialog-yes">${iconSVG('check', 40)}</div><div class="btn panel big deny" id="dialog-no">${iconSVG('cross', 40)}</div></div></div>`;
  container.append(vignette, confetti, banner, levelEl, dialog);

  const titleEl = banner.querySelector('.cel-title');
  const xpEl = banner.querySelector('.cel-xp');
  const gemsEl = banner.querySelector('.cel-gems');
  const hintEl = banner.querySelector('.cel-hint');
  const colors = CONFIG.palette.wool;

  function spawnConfetti(n) {
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'confetti';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      const x = Math.random() * W;
      p.style.transform = `translate(${x}px, -24px)`;
      confetti.appendChild(p);
      gsap.to(p, {
        x: x + (Math.random() - 0.5) * 200, y: H + 40, rotation: (Math.random() - 0.5) * 720,
        duration: 2.4 + Math.random() * 1.6, delay: Math.random() * 1.2, ease: 'power1.in', onComplete: () => p.remove(),
      });
    }
  }

  function celebrate({ name, xp, gems }) {
    vignette.style.display = '';
    gsap.fromTo(vignette, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    banner.style.display = '';
    titleEl.textContent = `YOU BUILT THE ${name.toUpperCase()}!`;
    xpEl.textContent = '+0 XP';
    gemsEl.innerHTML = `+0 ${iconSVG('gem', 26)}`;
    hintEl.style.opacity = 0;
    gsap.fromTo(banner, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.8)' });
    const o = { xp: 0, gems: 0 };
    gsap.to(o, {
      xp, gems, duration: 1.2, delay: 0.45, ease: 'power1.out',
      onUpdate: () => { xpEl.textContent = `+${Math.round(o.xp)} XP`; gemsEl.innerHTML = `+${Math.round(o.gems)} ${iconSVG('gem', 26)}`; },
    });
    gsap.to(hintEl, { opacity: 0.8, duration: 0.4, delay: 1.6 });
    spawnConfetti(48);
    let ended = false;
    return {
      end() {
        if (ended) return;
        ended = true;
        gsap.to(banner, { scale: 0.8, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: () => (banner.style.display = 'none') });
        gsap.to(vignette, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => (vignette.style.display = 'none') });
      },
    };
  }

  function levelUp(level) {
    levelEl.textContent = `LEVEL ${level}!`;
    levelEl.style.display = '';
    gsap.fromTo(levelEl, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.8)' });
    spawnConfetti(24);
    return new Promise((resolve) => {
      gsap.to(levelEl, { scale: 0.8, opacity: 0, duration: 0.25, delay: 2.0, ease: 'power2.in', onComplete: () => { levelEl.style.display = 'none'; resolve(); } });
    });
  }

  function confirmRemove() {
    return new Promise((resolve) => {
      dialog.style.display = '';
      const box = dialog.firstElementChild;
      gsap.fromTo(box, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.7)' });
      const done = (v) => (e) => {
        e.preventDefault();
        yes.removeEventListener('pointerup', onYes);
        no.removeEventListener('pointerup', onNo);
        gsap.to(box, { scale: 0.85, opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: () => { dialog.style.display = 'none'; resolve(v); } });
      };
      const yes = dialog.querySelector('#dialog-yes'), no = dialog.querySelector('#dialog-no');
      const onYes = done(true), onNo = done(false);
      yes.addEventListener('pointerup', onYes);
      no.addEventListener('pointerup', onNo);
    });
  }

  // n gem icons fly from (fx,fy) to (tx,ty); onEach(i) fires as each one lands.
  function flyGems(fx, fy, tx, ty, n, onEach) {
    for (let i = 0; i < n; i++) {
      const g = document.createElement('div');
      g.className = 'flying-gem';
      g.innerHTML = iconSVG('gem', 30);
      container.appendChild(g);
      const sx = fx + (Math.random() - 0.5) * 60, sy = fy + (Math.random() - 0.5) * 40;
      gsap.set(g, { x: sx, y: sy, scale: 0.6, opacity: 0 });
      const tl = gsap.timeline({ delay: i * 0.09, onComplete: () => { g.remove(); onEach?.(i); } });
      tl.to(g, { scale: 1.1, opacity: 1, duration: 0.2, ease: 'back.out(2)' })
        .to(g, { x: tx, duration: 0.7, ease: 'power2.in' }, '<0.1')
        .to(g, { y: sy - 70, duration: 0.25, ease: 'power2.out' }, '<')
        .to(g, { y: ty, duration: 0.45, ease: 'power2.in' }, '>')
        .to(g, { scale: 0.4, opacity: 0, duration: 0.1 }, '>-0.02');
    }
  }

  return { celebrate, levelUp, confirmRemove, flyGems, spawnConfetti };
}
