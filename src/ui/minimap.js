import { gsap } from 'gsap';
import { blockById, LIQUID } from '../data/blocks.js';

// Top-down village map: terrain colours from the atlas, building icons, villagers/animals, a "you" arrow.
export function createMinimap(container, { world, atlas, buildings, buildingIcons, animals, villagers, player }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'minimap';
  overlay.style.display = 'none';
  const box = document.createElement('div');
  box.className = 'panel map-box';
  const canvas = document.createElement('canvas');
  const SIZE = 384, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = canvas.height = SIZE * dpr;
  canvas.style.width = canvas.style.height = SIZE + 'px';
  box.appendChild(canvas);
  overlay.appendChild(box);
  container.appendChild(overlay);
  overlay.addEventListener('pointerup', (e) => { e.preventDefault(); close(); });
  const ctx = canvas.getContext('2d');
  let isOpen = false, terrain = null, timer = null;
  const scale = SIZE / world.sizeX;

  function renderTerrain() {
    const t = document.createElement('canvas');
    t.width = world.sizeX; t.height = world.sizeZ;
    const tc = t.getContext('2d');
    const img = tc.createImageData(world.sizeX, world.sizeZ);
    const d = img.data;
    for (let z = 0; z < world.sizeZ; z++) {
      for (let x = 0; x < world.sizeX; x++) {
        const top = world.topAt(x, z);
        const id = world.getBlock(x, top, z);
        const b = blockById(id);
        const col = atlas.avgColors[b.faces[2]] || [0.5, 0.5, 0.5];
        const shade = LIQUID[id] ? 1 : 0.7 + 0.3 * Math.max(0, Math.min(1, (top - 8) / 24));
        const i = (z * world.sizeX + x) * 4;
        d[i] = col[0] * 255 * shade; d[i + 1] = col[1] * 255 * shade; d[i + 2] = col[2] * 255 * shade; d[i + 3] = 255;
      }
    }
    tc.putImageData(img, 0, 0);
    return t;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrain, 0, 0, SIZE, SIZE);
    for (const inst of buildings.instances) {
      const c = buildings.center(inst);
      const icon = buildingIcons.render(buildings.type(inst), 44);
      ctx.globalAlpha = inst.complete ? 1 : 0.6;
      ctx.drawImage(icon, c.x * scale - 22, c.z * scale - 26, 44, 44);
      ctx.globalAlpha = 1;
    }
    for (const v of villagers.villagers) { ctx.fillStyle = '#3A6FD8'; ctx.beginPath(); ctx.arc(v.x * scale, v.z * scale, 3.5, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
    for (const a of animals.animals) { ctx.fillStyle = '#F2F2F2'; ctx.beginPath(); ctx.arc(a.x * scale, a.z * scale, 2.5, 0, 6.28); ctx.fill(); }
    // player arrow
    ctx.save();
    ctx.translate(player.x * scale, player.z * scale);
    ctx.rotate(Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw)) + Math.PI / 2);
    ctx.fillStyle = '#D9403A'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 3); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    terrain = renderTerrain();
    draw();
    overlay.style.display = '';
    gsap.fromTo(box, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.26, ease: 'back.out(1.6)' });
    timer = setInterval(draw, 250);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    clearInterval(timer);
    gsap.to(box, { scale: 0.85, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => (overlay.style.display = 'none') });
  }
  return { open, close, toggle: () => (isOpen ? close() : open()), get isOpen() { return isOpen; } };
}
