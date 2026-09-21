import { gsap } from 'gsap';

// Profile picker: two big avatar buttons with names. Resolves with the chosen profile id.
export function createPicker(container, { audio }) {
  const el = document.createElement('div');
  el.className = 'overlay solid';
  el.id = 'picker';
  el.style.display = 'none';
  el.innerHTML = '<div class="picker-title">Who is playing?</div><div class="picker-cards"></div>';
  container.appendChild(el);
  const cards = el.querySelector('.picker-cards');

  function open(list) {
    return new Promise((resolve) => {
      cards.replaceChildren();
      el.style.display = '';
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      list.forEach((p, i) => {
        const c = document.createElement('div');
        c.className = 'pick-card panel';
        c.appendChild(p.face);
        const name = document.createElement('div');
        name.className = 'pick-name';
        name.textContent = p.name;
        const lvl = document.createElement('div');
        lvl.className = 'pick-level';
        lvl.textContent = `LVL ${p.level}`;
        c.append(name, lvl);
        cards.appendChild(c);
        gsap.fromTo(c, { scale: 0.4, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, delay: 0.1 + i * 0.12, ease: 'back.out(1.8)' });
        let downAt = null;
        c.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; gsap.to(c, { scale: 0.94, duration: 0.08 }); });
        c.addEventListener('pointerup', (e) => {
          e.preventDefault();
          gsap.to(c, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' });
          if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 14) return;
          audio.tap();
          gsap.to(el, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => (el.style.display = 'none') });
          gsap.to(c, { scale: 1.15, duration: 0.25, ease: 'power2.out' });
          resolve(p.id);
        });
      });
    });
  }
  return { open, get isOpen() { return el.style.display === ''; } };
}
