// Emoji speech bubbles above villagers, positioned by projecting world points each frame.
export function createBubbles(container) {
  const layer = document.createElement('div');
  layer.id = 'bubbles';
  container.appendChild(layer);
  const live = new Map();

  function update(entries, toScreen) {
    const seen = new Set();
    for (const e of entries) {
      seen.add(e.id);
      let el = live.get(e.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'bubble';
        layer.appendChild(el);
        live.set(e.id, el);
        el.animate([{ transform: 'translate(-50%, -100%) scale(0.4)', opacity: 0 }, { transform: 'translate(-50%, -100%) scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
      if (el.textContent !== e.text) el.textContent = e.text;
      const p = toScreen(e.x, e.y, e.z);
      if (p.behind) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
    }
    for (const [id, el] of live) if (!seen.has(id)) { el.remove(); live.delete(id); }
  }
  return { update };
}
