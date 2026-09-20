import { gsap } from 'gsap';

// Top-centre "placed / total" bar for the nearest unfinished building.
export function createProgressBar(container) {
  const el = document.createElement('div');
  el.id = 'progress';
  el.className = 'panel';
  el.style.display = 'none';
  el.innerHTML = '<div class="pb-name"></div><div class="pb-count"></div><div class="pb-bar"><div class="pb-fill"></div></div>';
  container.appendChild(el);
  const nameEl = el.querySelector('.pb-name'), countEl = el.querySelector('.pb-count'), fill = el.querySelector('.pb-fill');
  let visible = false, currentUid = null;

  function show(name, placed, total, uid) {
    const pct = `${Math.round((placed / total) * 100)}%`;
    if (uid !== currentUid) {
      currentUid = uid;
      nameEl.textContent = name;
      gsap.set(fill, { width: pct });
    } else {
      gsap.to(fill, { width: pct, duration: 0.35, ease: 'power2.out' });
    }
    countEl.textContent = `${placed} / ${total}`;
    if (!visible) {
      visible = true;
      el.style.display = '';
      gsap.fromTo(el, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.26, ease: 'power2.out' });
    }
  }

  function hide() {
    if (!visible) return;
    visible = false;
    currentUid = null;
    gsap.to(el, { y: -24, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => { if (!visible) el.style.display = 'none'; } });
  }

  return { show, hide, el };
}
