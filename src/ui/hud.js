import { gsap } from 'gsap';
import { iconSVG } from './icons.js';
import { CONFIG } from '../config.js';

function pressable(el, onDown, onUp) {
  let downId = null;
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('disabled')) return;
    e.preventDefault();
    e.stopPropagation();
    downId = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    gsap.to(el, { scale: 0.94, duration: 0.08, ease: 'power2.out' });
    onDown?.(e);
  });
  const release = (e) => {
    if (downId === null) return;
    downId = null;
    gsap.to(el, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' });
    onUp?.(e);
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
}

function button({ id, icon, label, cls = '', disabled = false }) {
  const b = document.createElement('div');
  b.className = `btn panel ${cls}${disabled ? ' disabled' : ''}`;
  if (id) b.id = id;
  b.innerHTML = iconSVG(icon, cls.includes('big') ? 40 : 30) + (label ? `<span class="lbl">${label}</span>` : '');
  return b;
}

export function createHUD(container, avatarFaceCanvas, cb) {
  const I = CONFIG.input;

  // --- top-left stack ---
  const tl = document.createElement('div');
  tl.id = 'tl';
  const pauseBtn = button({ id: 'btn-pause', icon: 'pause' });
  pressable(pauseBtn, null, () => cb.onPause?.());

  const pill = document.createElement('div');
  pill.id = 'level-pill';
  pill.className = 'panel';
  const face = document.createElement('div');
  face.className = 'face';
  face.appendChild(avatarFaceCanvas);
  const pillText = document.createElement('div');
  pillText.className = 'pill-text';
  pillText.innerHTML = '<span class="lvl">LVL 1</span><div class="xp"><div class="xp-fill"></div></div>';
  pill.append(face, pillText);
  // three-finger tap toggles the debug overlay
  const pillTaps = [];
  pill.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    pillTaps.push({ id: e.pointerId, t: now });
    while (pillTaps.length && now - pillTaps[0].t > 400) pillTaps.shift();
    if (new Set(pillTaps.map((p) => p.id)).size >= 3) {
      pillTaps.length = 0;
      cb.onDebugToggle?.();
    }
  });

  const camBtn = button({ id: 'btn-camera', icon: 'camera' });
  pressable(camBtn, null, () => cb.onCamera?.());
  const mapBtn = button({ id: 'btn-map', icon: 'map' });
  pressable(mapBtn, null, () => cb.onMap?.());
  tl.append(pauseBtn, pill, camBtn, mapBtn);

  // --- top-right gems ---
  const tr = document.createElement('div');
  tr.id = 'tr';
  tr.className = 'panel';
  tr.innerHTML = iconSVG('gem', 30) + '<span id="gem-count">0</span>';

  // --- right stack ---
  const rs = document.createElement('div');
  rs.id = 'right-stack';
  const buildBtn = button({ id: 'btn-build', icon: 'hammer', label: 'Build', cls: 'big' });
  pressable(buildBtn, null, () => cb.onBuild?.());
  const flyBtn = button({ id: 'btn-fly', icon: 'wings', label: 'Fly', cls: 'big' });
  pressable(flyBtn, null, () => cb.onFly?.());
  const jumpBtn = button({ id: 'btn-jump', icon: 'arrowUp', label: 'Jump', cls: 'big jump' });
  let lastJumpTap = 0;
  pressable(jumpBtn, () => {
    const now = performance.now();
    if (now - lastJumpTap < I.doubleTapMs) {
      lastJumpTap = 0;
      cb.onFly?.();
    } else lastJumpTap = now;
    cb.onJumpDown?.();
  }, () => cb.onJumpUp?.());
  const downBtn = button({ id: 'btn-down', icon: 'arrowDown', label: 'Down', cls: 'big' });
  downBtn.style.display = 'none';
  pressable(downBtn, () => cb.onDescendDown?.(), () => cb.onDescendUp?.());
  rs.append(buildBtn, flyBtn, jumpBtn, downBtn);

  // --- bottom-right inventory ---
  const invBtn = button({ id: 'btn-inventory', icon: 'grid' });
  pressable(invBtn, null, () => cb.onInventory?.());

  // --- placement bar (top-centre while positioning a blueprint) ---
  const placement = document.createElement('div');
  placement.id = 'placement';
  placement.className = 'panel';
  placement.style.display = 'none';
  placement.innerHTML = `${iconSVG('hammer', 26)}<span class="pl-name"></span><div class="btn panel small" id="btn-cancel-place">${iconSVG('cross', 26)}</div>`;
  pressable(placement.querySelector('#btn-cancel-place'), null, () => cb.onCancelPlacement?.());

  container.append(tl, tr, rs, invBtn, placement);

  const gemCount = tr.querySelector('#gem-count');
  const xpFill = pill.querySelector('.xp-fill');
  const lvl = pill.querySelector('.lvl');
  let gems = 0;

  return {
    el: container,
    pill,
    setLevel(level, frac) {
      const changed = lvl.textContent !== `LVL ${level}`;
      lvl.textContent = `LVL ${level}`;
      gsap.to(xpFill, { width: `${Math.round(frac * 100)}%`, duration: 0.6, ease: 'power2.out' });
      if (changed) gsap.fromTo(pill, { scale: 1.15 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    },
    levelBump() {
      gsap.fromTo(pill, { scale: 1.2 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    },
    gemCounterPoint() {
      const r = tr.querySelector('.icon').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    flashGems() {
      gsap.fromTo(tr, { backgroundColor: 'rgba(217,64,58,0.7)', x: -5 }, { backgroundColor: 'rgba(40,44,52,0.55)', x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    },
    showPlacement(name) {
      placement.querySelector('.pl-name').textContent = name;
      placement.style.display = '';
      gsap.fromTo(placement, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.26, ease: 'power2.out' });
    },
    hidePlacement() {
      gsap.to(placement, { y: -24, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => (placement.style.display = 'none') });
    },
    shakePlacement() {
      gsap.fromTo(placement, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    },
    setGems(n) {
      if (n === gems) return;
      const from = gems;
      gems = n;
      const o = { v: from };
      gsap.to(o, { v: n, duration: 0.5, ease: 'power1.out', onUpdate: () => (gemCount.textContent = Math.round(o.v)) });
      gsap.fromTo(tr, { scale: 1.2 }, { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
    },
    setFlyMode(on) {
      flyBtn.classList.toggle('active', on);
      if (on) {
        downBtn.style.display = '';
        gsap.fromTo(downBtn, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' });
        jumpBtn.querySelector('.lbl').textContent = 'Up';
      } else {
        gsap.to(downBtn, { y: -30, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => (downBtn.style.display = 'none') });
        jumpBtn.querySelector('.lbl').textContent = 'Jump';
      }
    },
    setCameraMode(mode) {
      camBtn.classList.toggle('active', mode === 'first');
    },
    bump() {
      gsap.fromTo(container, { y: 0 }, { y: 5, duration: 0.05, yoyo: true, repeat: 1, ease: 'power1.inOut' });
    },
  };
}
