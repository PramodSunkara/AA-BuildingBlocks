import { CONFIG } from '../config.js';

export function createDebugOverlay(container) {
  const el = document.createElement('div');
  el.id = 'debug';
  el.className = 'panel';
  el.style.display = 'none';
  container.appendChild(el);
  const text = document.createElement('div');
  const glBtn = document.createElement('div');
  glBtn.className = 'debug-btn';
  glBtn.textContent = 'lose GL';
  el.append(text, glBtn);
  let onLose = null;
  glBtn.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); onLose?.(); });
  let visible = false;
  let frames = 0, acc = 0, fps = 0, worst = 0, lastReport = performance.now();
  const extra = {};

  return {
    toggle() {
      visible = !visible;
      el.style.display = visible ? '' : 'none';
    },
    set(key, value) {
      extra[key] = value;
    },
    frame(dt, info, chunkMeshes) {
      frames++;
      acc += dt;
      worst = Math.max(worst, dt);
      const now = performance.now();
      if (now - lastReport < 500) return;
      fps = frames / acc;
      lastReport = now;
      if (!visible) { frames = 0; acc = 0; worst = 0; return; }
      const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'n/a';
      text.innerHTML = [
        `fps ${fps.toFixed(0)}  frame ${(1000 / fps).toFixed(1)} ms  worst ${(worst * 1000).toFixed(1)} ms`,
        `draw calls ${info.render.calls}  tris ${info.render.triangles}`,
        `chunk meshes ${chunkMeshes}  geometries ${info.memory.geometries}  textures ${info.memory.textures}`,
        `memory ${mem}  persisted ${extra.persisted ?? '?'}`,
        `pos ${extra.pos ?? ''}`,
        `v${CONFIG.version}  dpr ${Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio)}  ${extra.size ?? ''}`,
      ].join('<br>');
      frames = 0;
      acc = 0;
      worst = 0;
    },
    get fps() {
      return fps;
    },
    setLoseContext(fn) {
      onLose = fn;
    },
  };
}
