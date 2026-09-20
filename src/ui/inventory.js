import { gsap } from 'gsap';
import { iconSVG } from './icons.js';
import { PACKS, itemsInPack, GRASS, WOOL_FIRST, FLOWER_RED, BED } from '../data/blocks.js';

const TAB_ICON = { base: GRASS, colors: WOOL_FIRST, nature: FLOWER_RED, furniture: BED, animals: 'animal:cow' };
const TAB_LABEL = { base: 'Base', colors: 'Colors', nature: 'Nature', furniture: 'Home', animals: 'Animals' };

// Bottom sheet above the hotbar: tabs per pack, tap an item to put it in the selected hotbar slot.
export function createInventory(container, { icons, hotbar, audio, onOpen, onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop soft';
  backdrop.style.display = 'none';
  const panel = document.createElement('div');
  panel.id = 'inventory';
  panel.className = 'panel sheet';
  panel.style.display = 'none';
  panel.innerHTML = '<div class="tabs"></div><div class="inv-grid scroll"></div>';
  container.append(backdrop, panel);
  const tabsEl = panel.querySelector('.tabs'), grid = panel.querySelector('.inv-grid');
  grid.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  backdrop.addEventListener('pointerup', (e) => { e.preventDefault(); close(); });
  let isOpen = false, current = 'base';

  const cloneCanvas = (src) => {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height; c.style.width = src.style.width; c.style.height = src.style.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  };

  for (const pack of PACKS) {
    const t = document.createElement('div');
    t.className = 'tab';
    t.dataset.pack = pack;
    t.appendChild(cloneCanvas(icons.render(TAB_ICON[pack], 36)));
    const l = document.createElement('span');
    l.textContent = TAB_LABEL[pack];
    t.appendChild(l);
    t.addEventListener('pointerup', (e) => { e.preventDefault(); if (current !== pack) { audio.tap(); select(pack); } });
    tabsEl.appendChild(t);
  }

  function select(pack) {
    current = pack;
    for (const t of tabsEl.children) t.classList.toggle('active', t.dataset.pack === pack);
    grid.replaceChildren();
    const items = itemsInPack(pack);
    items.forEach((item, i) => {
      const id = typeof item === 'object' ? item.id : item;
      const cell = document.createElement('div');
      cell.className = 'inv-item';
      cell.appendChild(cloneCanvas(icons.render(id, 56)));
      let downAt = null;
      cell.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
      cell.addEventListener('pointerup', (e) => {
        e.preventDefault();
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 12) return;
        hotbar.setSlot(hotbar.selectedIndex, id);
        audio.tap();
        gsap.fromTo(cell, { scale: 0.8 }, { scale: 1, duration: 0.35, ease: 'back.out(2.5)' });
      });
      grid.appendChild(cell);
      gsap.from(cell, { opacity: 0, y: 8, duration: 0.2, delay: Math.min(0.3, i * 0.015), ease: 'power2.out', clearProps: 'all' });
    });
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    select(current);
    backdrop.style.display = '';
    panel.style.display = '';
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.26, ease: 'power2.out' });
    gsap.fromTo(panel, { y: '110%', opacity: 0.6 }, { y: '0%', opacity: 1, duration: 0.26, ease: 'power2.out' });
    onOpen?.();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    gsap.to(backdrop, { opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => (backdrop.style.display = 'none') });
    gsap.to(panel, { y: '110%', duration: 0.2, ease: 'power2.in', onComplete: () => (panel.style.display = 'none') });
    onClose?.();
  }
  return { open, close, toggle: () => (isOpen ? close() : open()), get isOpen() { return isOpen; } };
}
