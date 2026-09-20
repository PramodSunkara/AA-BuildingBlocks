import { gsap } from 'gsap';
import { iconSVG } from './icons.js';

// Small bottom-left toast, e.g. "Updated, restart to apply". Tap runs the action.
export function createToast(container) {
  const el = document.createElement('div');
  el.id = 'toast';
  el.className = 'panel';
  el.style.display = 'none';
  container.appendChild(el);
  let action = null;
  el.addEventListener('pointerup', (e) => { e.preventDefault(); const a = action; hide(); a?.(); });

  function show(text, { icon = 'resume', onTap = null } = {}) {
    action = onTap;
    el.innerHTML = iconSVG(icon, 26) + `<span>${text}</span>`;
    el.style.display = '';
    gsap.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.6)' });
  }
  function hide() {
    gsap.to(el, { y: 30, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => (el.style.display = 'none') });
  }
  return { show, hide };
}
