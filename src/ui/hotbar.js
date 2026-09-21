import { gsap } from 'gsap';

export function createHotbar(container, iconRenderer, slots, onSelect, onChange) {
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
    // tap selects; dragging more than 10 px lifts the icon and drops it on another slot (swap)
    s.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const x0 = e.clientX, y0 = e.clientY;
      let ghost = null;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) {
          ghost = document.createElement('div');
          ghost.className = 'drag-ghost';
          const c = s.querySelector('canvas');
          if (c) ghost.appendChild(c.cloneNode(true)) && ghost.firstChild.getContext('2d').drawImage(c, 0, 0);
          document.body.appendChild(ghost);
          s.classList.add('dragging');
        }
        if (ghost) ghost.style.transform = `translate(${ev.clientX - 28}px, ${ev.clientY - 28}px)`;
      };
      const up = (ev) => {
        s.removeEventListener('pointermove', move);
        s.removeEventListener('pointerup', up);
        s.removeEventListener('pointercancel', up);
        try { s.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (!ghost) { select(i); return; }
        ghost.remove();
        s.classList.remove('dragging');
        const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.slot');
        if (under && under !== s) swap(i, parseInt(under.dataset.index, 10));
      };
      try { s.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      s.addEventListener('pointermove', move);
      s.addEventListener('pointerup', up);
      s.addEventListener('pointercancel', up);
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
    onChange?.(state.slots.slice());
  }

  function swap(a, b) {
    [state.slots[a], state.slots[b]] = [state.slots[b], state.slots[a]];
    renderSlot(a);
    renderSlot(b);
    gsap.fromTo([slotEls[a], slotEls[b]], { scale: 0.85 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    select(b);
    onChange?.(state.slots.slice());
  }

  function load(slots) {
    for (let i = 0; i < state.slots.length; i++) {
      state.slots[i] = slots[i] ?? state.slots[i];
      renderSlot(i);
    }
    gsap.fromTo(slotEls, { scale: 0.85 }, { scale: 1, duration: 0.3, stagger: 0.03, ease: 'back.out(2)' });
  }

  select(0, false);
  return {
    el,
    load,
    select,
    setSlot,
    cycle(delta) { select((selected + delta + state.slots.length) % state.slots.length); },
    get selectedBlock() { return state.slots[selected]; },
    get selectedIndex() { return selected; },
    get slots() { return state.slots; },
  };
}
