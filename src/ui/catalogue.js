import { gsap } from 'gsap';
import { iconSVG } from './icons.js';
import { BUILDINGS } from '../data/buildings/index.js';

// Full-height Build catalogue: slides in from the right edge, dims the world behind it.
export function createCatalogue(container, { icons, progression, audio, onPick, onNeedGems, onOpen, onClose, getCustom, onSaveBuild }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.style.display = 'none';
  const panel = document.createElement('div');
  panel.id = 'catalogue';
  panel.className = 'panel side-panel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <div class="side-header">${iconSVG('hammer', 30)}<span>Build</span>
      <div class="tabs mini"><div class="tab active" data-tab="all">${iconSVG('grid', 22)}</div><div class="tab" data-tab="mine">${iconSVG('camera', 22)}</div></div>
      <div class="btn panel small" id="catalogue-close">${iconSVG('cross', 26)}</div></div>
    <div class="cards scroll"></div>`;
  container.append(backdrop, panel);
  const cards = panel.querySelector('.cards');
  cards.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  panel.querySelector('#catalogue-close').addEventListener('pointerup', (e) => { e.preventDefault(); close(); });
  backdrop.addEventListener('pointerup', (e) => { e.preventDefault(); close(); });
  let isOpen = false, tab = 'all';
  for (const t of panel.querySelectorAll('.tabs .tab')) {
    t.addEventListener('pointerup', (e) => { e.preventDefault(); if (tab !== t.dataset.tab) { tab = t.dataset.tab; audio.tap(); buildCards(); } });
  }

  function cloneCanvas(src) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.style.width = src.style.width;
    c.style.height = src.style.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  function buildCards() {
    cards.replaceChildren();
    for (const t of panel.querySelectorAll('.tabs .tab')) t.classList.toggle('active', t.dataset.tab === tab);
    if (tab === 'mine') {
      const save = document.createElement('div');
      save.className = 'card panel save-card';
      save.innerHTML = `<div class="save-icon">${iconSVG('camera', 56)}</div><div class="card-name">Save my build</div>`;
      save.addEventListener('pointerup', (e) => { e.preventDefault(); audio.tap(); close(); onSaveBuild?.(); });
      cards.appendChild(save);
    }
    const list = tab === 'mine' ? (getCustom?.() || []) : BUILDINGS;
    for (const b of list) {
      const card = document.createElement('div');
      card.className = 'card panel';
      const locked = progression.isLevelLocked(b);
      const unlocked = progression.isUnlocked(b);
      if (locked) card.classList.add('locked');
      card.appendChild(cloneCanvas(icons.render(b, 140)));
      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = b.name;
      const meta = document.createElement('div');
      meta.className = 'card-meta';
      let state = '';
      if (locked) state = `<span class="tag lock">${iconSVG('lock', 20)} LVL ${b.level}</span>`;
      else if (!unlocked) state = `<span class="tag cost">${iconSVG('gem', 20)} ${b.gemCost}</span>`;
      else state = `<span class="tag ok">${iconSVG('check', 20)}</span>`;
      meta.innerHTML = `<span class="tag">${iconSVG('grid', 18)} ${b.voxels.length}</span>${state}`;
      card.append(name, meta);
      let downAt = null;
      card.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
      card.addEventListener('pointerup', (e) => {
        e.preventDefault();
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 12) return;
        pick(b, card);
      });
      cards.appendChild(card);
    }
  }

  function shake(card) {
    gsap.fromTo(card, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
  }

  function pick(b, card) {
    if (progression.isLevelLocked(b)) { shake(card); audio.error(); return; }
    if (!progression.isUnlocked(b)) {
      if (!progression.unlock(b)) { shake(card); audio.error(); onNeedGems?.(); return; }
    }
    audio.tap();
    close();
    onPick(b);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    buildCards();
    backdrop.style.display = '';
    panel.style.display = '';
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.26, ease: 'power2.out' });
    gsap.fromTo(panel, { x: '100%', opacity: 0.6 }, { x: '0%', opacity: 1, duration: 0.26, ease: 'power2.out' });
    onOpen?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    gsap.to(backdrop, { opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => (backdrop.style.display = 'none') });
    gsap.to(panel, { x: '100%', duration: 0.2, ease: 'power2.in', onComplete: () => (panel.style.display = 'none') });
    onClose?.();
  }

  return { open, close, get isOpen() { return isOpen; } };
}
