import { gsap } from 'gsap';

export function createHotbar(container, iconRenderer, slots, onSelect) {
  const el = document.createElement('div');
  el.id = 'hotbar';
  el.className = 'panel';
  container.appendChild(el);
  const slotEls = [];
  let selected = 0;
  const state = { slots: slots.slice() };

  for (let i = 0; i < state.slots.length; i++) {
    const s = document.createElement('div');
    s.className = 'slot';
    s.dataset.index = i;
    s.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      select(i);
    });
    el.appendChild(s);
    slotEls.push(s);
    renderSlot(i);
  }

  function renderSlot(i) {
    const s = slotEls[i];
    s.replaceChildren();
    const id = state.slots[i];
    if (id) {
      const icon = iconRenderer.render(id);
      const c = document.createElement('canvas');
      c.width = icon.width;
      c.height = icon.height;
      c.style.width = icon.style.width;
      c.style.height = icon.style.height;
      c.getContext('2d').drawImage(icon, 0, 0);
      s.appendChild(c);
    }
  }

  function select(i, animate = true) {
    if (i === selected && slotEls[i].classList.contains('selected')) return;
    const prev = slotEls[selected];
    prev.classList.remove('selected');
    if (animate) gsap.to(prev, { y: 0, duration: 0.2, ease: 'power2.out' });
    selected = i;
    const cur = slotEls[i];
    cur.classList.add('selected');
    if (animate) gsap.fromTo(cur, { y: 0 }, { y: -6, duration: 0.25, ease: 'back.out(2.5)' });
    else cur.style.transform = 'translateY(-6px)';
    onSelect?.(state.slots[i], i);
  }

  function setSlot(i, blockId) {
    state.slots[i] = blockId;
    renderSlot(i);
    gsap.fromTo(slotEls[i], { scale: 0.85 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
  }

  select(0, false);
  return {
    el,
    select,
    setSlot,
    cycle(delta) { select((selected + delta + state.slots.length) % state.slots.length); },
    get selectedBlock() { return state.slots[selected]; },
    get selectedIndex() { return selected; },
    get slots() { return state.slots; },
  };
}
