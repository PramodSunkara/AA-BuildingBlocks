import './style.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { registerSW } from 'virtual:pwa-register';
import { CONFIG } from './config.js';
import { World } from './world/world.js';
import { generateTerrain } from './world/terrain.js';
import { ChunkRenderer } from './world/chunkRenderer.js';
import { raycastVoxels } from './world/raycast.js';
import { loadWorldSave, applyWorldSave, createAutosaver, loadMeta, saveMeta } from './world/save.js';
import { buildAtlas } from './render/atlas.js';
import { createMaterials } from './render/materials.js';
import { createRenderer } from './render/renderer.js';
import { createLighting } from './render/lighting.js';
import { createSky } from './render/sky.js';
import { Particles } from './render/particles.js';
import { Highlight } from './render/highlight.js';
import { createEdgeWalls } from './render/walls.js';
import { paintSkin } from './player/skin.js';
import { Avatar } from './player/avatar.js';
import { PlayerController } from './player/controller.js';
import { CameraRig } from './player/camera.js';
import { createJoystick } from './input/joystick.js';
import { setupTouch } from './input/touch.js';
import { setupDesktop } from './input/desktop.js';
import { createBlockIconRenderer } from './ui/blockIcons.js';
import { createHotbar } from './ui/hotbar.js';
import { createHUD } from './ui/hud.js';
import { createDebugOverlay } from './ui/debug.js';
import { iconSVG } from './ui/icons.js';
import { createAudio } from './audio/audio.js';
import { blockById, HOTBAR_DEFAULT, REPLACEABLE, LIQUID, AIR } from './data/blocks.js';

const canvas = document.getElementById('c');
const hudEl = document.getElementById('hud');
const startEl = document.getElementById('start');
const startStatus = document.getElementById('start-status');
const startPlay = document.getElementById('start-play');

async function boot() {
  startPlay.innerHTML = iconSVG('play', 48);
  const audio = createAudio();

  // --- renderer, atlas, materials ---
  const R = createRenderer(canvas);
  const renderer = R.renderer;
  const atlas = buildAtlas();
  atlas.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const materials = createMaterials(atlas.texture);

  // --- world: generate from seed, then apply saved edits ---
  const world = new World(CONFIG);
  generateTerrain(world);
  const meta = await loadMeta();
  const save = await loadWorldSave();
  const editCount = save ? applyWorldSave(world, save) : 0;

  const scene = new THREE.Scene();
  const sky = createSky(scene);
  const lighting = createLighting(scene);
  const chunkRenderer = new ChunkRenderer(world, scene, materials);
  chunkRenderer.buildAll();

  // --- player, avatar, camera ---
  const profile = CONFIG.players[0]; // Stage 1: profile picker comes in Stage 4
  const skin = paintSkin(profile);
  const avatar = new Avatar(skin.texture);
  scene.add(avatar.group);
  const player = new PlayerController(world);
  const sp = world.spawn;
  const groundY = world.topAt(Math.floor(sp.x), Math.floor(sp.z)) + 1;
  player.setPosition(sp.x, Math.max(sp.y, groundY), sp.z);
  const rig = new CameraRig(R.width / R.height, world);
  const camera = rig.camera;
  const highlight = new Highlight(scene, atlas);
  const particles = new Particles(scene);
  const walls = createEdgeWalls(scene);

  // --- HUD ---
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 80;
  faceCanvas.style.width = faceCanvas.style.height = '40px';
  const fctx = faceCanvas.getContext('2d');
  fctx.imageSmoothingEnabled = false;
  fctx.drawImage(skin.canvas, 8, 8, 8, 8, 0, 0, 80, 80);

  const debug = createDebugOverlay(hudEl);
  const hud = createHUD(hudEl, faceCanvas, {
    onPause: () => setPaused(true),
    onCamera: () => { hud.setCameraMode(rig.toggle()); audio.tap(); },
    onFly: () => { hud.setFlyMode(player.toggleFly()); audio.tap(); },
    onJumpDown: () => { player.requestJump(); player.jumpHeld = true; },
    onJumpUp: () => { player.jumpHeld = false; },
    onDescendDown: () => { player.descendHeld = true; },
    onDescendUp: () => { player.descendHeld = false; },
    onDebugToggle: () => debug.toggle(),
  });
  const iconRenderer = createBlockIconRenderer(atlas, 56);
  const hotbar = createHotbar(hudEl, iconRenderer, HOTBAR_DEFAULT, () => audio.tap());
  hud.setLevel(1, 0);
  hud.setGems(0);
  R.onResize((w, h) => {
    rig.setAspect(w / h);
    highlight.setResolution(w, h);
    debug.set('size', `${w}x${h}`);
  });

  // --- pause overlay (Stage 1: resume only) ---
  let paused = false;
  const pauseEl = document.createElement('div');
  pauseEl.className = 'overlay';
  pauseEl.style.display = 'none';
  pauseEl.innerHTML = `<div class="dialog panel"><div>Paused</div><div class="btn panel big" id="btn-resume">${iconSVG('resume', 40)}</div></div>`;
  hudEl.appendChild(pauseEl);
  pauseEl.querySelector('#btn-resume').addEventListener('pointerup', (e) => { e.preventDefault(); setPaused(false); });
  function setPaused(p) {
    paused = p;
    touch.releaseAll();
    pauseEl.style.display = p ? '' : 'none';
    if (p) gsap.fromTo(pauseEl.firstChild, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.7)' });
    else last = performance.now();
    audio.tap();
  }

  // --- targeting ---
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const getBlock = world.getBlock.bind(world);
  const targetable = (id) => id !== AIR && !LIQUID[id];
  function targetAt(sx, sy) {
    ndc.set((sx / R.width) * 2 - 1, -(sy / R.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const eye = player.eye();
    const camDist = Math.hypot(o.x - eye.x, o.y - eye.y, o.z - eye.z);
    const reach = CONFIG.player.reach;
    const hit = raycastVoxels(getBlock, o.x, o.y, o.z, d.x, d.y, d.z, camDist + reach + 1, targetable);
    if (!hit) return null;
    if (Math.hypot(hit.x + 0.5 - eye.x, hit.y + 0.5 - eye.y, hit.z + 0.5 - eye.z) > reach + 0.7) return null;
    return hit;
  }

  function tryPlace(sx, sy) {
    const hit = targetAt(sx, sy);
    if (!hit) return;
    let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    if (REPLACEABLE[hit.id]) { px = hit.x; py = hit.y; pz = hit.z; }
    if (!world.inBounds(px, py, pz) || py < CONFIG.world.digLimitY) return;
    if (!REPLACEABLE[world.getBlock(px, py, pz)]) return;
    const id = hotbar.selectedBlock;
    const block = blockById(id);
    if (block.solid && player.overlapsCell(px, py, pz)) return;
    if (!world.setBlock(px, py, pz, id)) return;
    highlight.playPop(px, py, pz, id);
    audio.place(block.sound);
  }

  function breakBlock(hit) {
    if (hit.y < CONFIG.world.digLimitY) return;
    const block = blockById(hit.id);
    if (!Number.isFinite(block.breakTime)) return;
    if (!world.setBlock(hit.x, hit.y, hit.z, AIR)) return;
    const [lo, hi] = CONFIG.particles.breakCount;
    particles.burst(hit.x, hit.y, hit.z, atlas.avgColors[block.faces[0]] || [1, 1, 1], lo + Math.floor(Math.random() * (hi - lo + 1)));
    audio.break(block.sound);
    hud.bump();
    rig.shake(0.05, 0.12);
  }

  // long-press holds (one per finger / the mouse)
  const holds = new Map();
  function updateHolds(dt) {
    let first = null;
    for (const h of holds.values()) {
      const sx = h.centered ? R.width / 2 : h.sx, sy = h.centered ? R.height / 2 : h.sy;
      const hit = targetAt(sx, sy);
      const key = hit ? `${hit.x},${hit.y},${hit.z}` : null;
      if (key !== h.key) { h.key = key; h.target = hit; h.progress = 0; }
      if (!hit) continue;
      const block = blockById(hit.id);
      if (!Number.isFinite(block.breakTime) || hit.y < CONFIG.world.digLimitY) continue;
      h.progress += dt / block.breakTime;
      if (h.progress >= 1) {
        breakBlock(hit);
        h.progress = 0;
        h.key = null;
        h.target = null;
      }
      if (!first) first = h;
    }
    highlight.setCrack(first?.target ?? null, first?.progress ?? 0);
  }

  // --- input ---
  const joyMove = { x: 0, y: 0 }, kbMove = { x: 0, y: 0 };
  const joystick = createJoystick(document.getElementById('joystick'), (x, y) => { joyMove.x = x; joyMove.y = y; });
  const actions = {
    look: (dx, dy) => player.look(dx, dy, CONFIG.camera.lookDegPerPx),
    lookMouse: (dx, dy) => player.look(dx, dy, CONFIG.camera.mouseDegPerPx),
    tap: (sx, sy) => tryPlace(sx, sy),
    holdStart: (id, sx, sy) => holds.set(id, { sx, sy, centered: id === 'mouse', key: null, target: null, progress: 0 }),
    holdMove: (id, sx, sy) => { const h = holds.get(id); if (h) { h.sx = sx; h.sy = sy; } },
    holdEnd: (id) => holds.delete(id),
    jumpDown: () => { player.requestJump(); player.jumpHeld = true; },
    jumpUp: () => { player.jumpHeld = false; },
    toggleFly: () => hud.setFlyMode(player.toggleFly()),
    toggleCamera: () => hud.setCameraMode(rig.toggle()),
    toggleDebug: () => debug.toggle(),
    pause: () => setPaused(!paused),
    selectSlot: (i) => hotbar.select(i),
    cycleSlot: (d) => hotbar.cycle(d),
    setKeyboardMove: (x, y) => { kbMove.x = x; kbMove.y = y; },
    setSprintKey: (v) => { player.sprintKey = v; },
    setDescend: (v) => { player.descendHeld = v; },
  };
  const touch = setupTouch({ canvas, joystick, actions });
  const desktop = setupDesktop({ canvas, actions });

  // --- persistence ---
  const autosaver = createAutosaver(world, CONFIG.autosaveDelayMs, (ok) => debug.set('saved', ok));
  let persisted = null;
  try {
    if (navigator.storage?.persist) persisted = await navigator.storage.persist();
  } catch { persisted = null; }
  debug.set('persisted', persisted);
  if (!meta.firstLaunch) meta.firstLaunch = Date.now();
  meta.persisted = persisted;
  meta.version = CONFIG.version;
  saveMeta(meta);
  document.addEventListener('visibilitychange', () => { if (document.hidden) touch.releaseAll(); });

  // --- service worker ---
  registerSW({ immediate: true });

  // --- game loop ---
  let started = false;
  let last = performance.now();
  let stepAcc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (!paused && started) {
      desktop.update();
      if (joystick.active) { player.move.x = joyMove.x; player.move.y = joyMove.y; }
      else { player.move.x = kbMove.x; player.move.y = kbMove.y; }
      player.update(dt);
      if (player.landed) audio.land();
      if (player.onGround && player.speedNorm > 0.2) {
        stepAcc += player.speedNorm * dt * CONFIG.player.walkSpeed;
        if (stepAcc > 1.7) {
          stepAcc = 0;
          audio.step(blockById(world.getBlock(Math.floor(player.x), Math.floor(player.y) - 1, Math.floor(player.z))).sound);
        }
      }
      rig.update(dt, player);
      avatar.update(dt, {
        x: player.x, y: player.y + player.stepOffset, z: player.z,
        speed: player.speedNorm, onGround: player.onGround, flying: player.flying,
        lookYaw: player.yaw, lookPitch: player.pitch, moving: player.moving, moveYaw: player.moveYaw,
      });
      avatar.group.visible = rig.avatarVisible;
      lighting.update(player.x, player.y, player.z);
      chunkRenderer.update(CONFIG.render.maxRemeshPerFrame);
      updateHolds(dt);
      highlight.setTarget(targetAt(R.width / 2, R.height / 2));
      highlight.update(dt);
      particles.update(dt);
      walls.update(player.x, player.z);
      debug.set('pos', `${player.x.toFixed(1)} ${player.y.toFixed(1)} ${player.z.toFixed(1)}  edits ${editCount}`);
    } else {
      rig.update(dt, player);
    }
    sky.update(camera.position);
    renderer.render(scene, camera);
    debug.frame(dt, renderer.info, chunkRenderer.meshCount);
  }
  requestAnimationFrame(frame);

  // --- start card ---
  startStatus.textContent = 'Tap to play';
  startEl.classList.add('ready');
  const begin = (e) => {
    e.preventDefault();
    audio.unlock();
    audio.tap();
    started = true;
    last = performance.now();
    gsap.to(startEl, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => startEl.remove() });
    gsap.from('#hud > *', { opacity: 0, y: 12, duration: 0.3, stagger: 0.04, ease: 'power2.out', clearProps: 'opacity,transform' });
  };
  startEl.addEventListener('pointerup', begin, { once: true });

  // expose for debugging in the console
  window.__bv = { world, player, rig, chunkRenderer, renderer, autosaver, atlas, actions, debug, targetAt, hotbar, scene };
}

boot().catch((e) => {
  console.error(e);
  startStatus.textContent = 'Something went wrong: ' + e.message;
});
