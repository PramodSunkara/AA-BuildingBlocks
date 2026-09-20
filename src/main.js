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
import { loadWorldSave, applyWorldSave, serializeWorld, createAutosaver, loadMeta, loadKey } from './world/save.js';
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
import { createBuildingIconRenderer } from './ui/buildingIcons.js';
import { createHotbar } from './ui/hotbar.js';
import { createHUD } from './ui/hud.js';
import { createDebugOverlay } from './ui/debug.js';
import { createCatalogue } from './ui/catalogue.js';
import { createProgressBar } from './ui/progressBar.js';
import { createOverlays } from './ui/overlays.js';
import { iconSVG } from './ui/icons.js';
import { createAudio } from './audio/audio.js';
import { blockById, HOTBAR_DEFAULT, REPLACEABLE, LIQUID, AIR, GHOST } from './data/blocks.js';
import { BUILDING_BY_ID } from './data/buildings/index.js';
import { BuildingManager, isGround } from './game/buildings.js';
import { Progression, createProfileState } from './game/progression.js';

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

  // --- persistence (world, buildings, profiles share one debounced autosaver) ---
  const buildings = new BuildingManager(world);
  const profiles = (await loadKey('profiles')) || {};
  const profileId = profiles.current || 'p1';
  if (!profiles[profileId]) profiles[profileId] = createProfileState(profileId);
  profiles.current = profileId;
  const profileState = profiles[profileId];
  const autosaver = createAutosaver({
    delayMs: CONFIG.autosaveDelayMs,
    savers: { world: () => serializeWorld(world), buildings: () => buildings.serialize(), profiles: () => profiles, meta: () => meta },
    onSaved: (ok, keys) => debug.set('saved', `${ok} ${keys.join(',')}`),
  });
  world.onChange = () => autosaver.markDirty('world');
  buildings.onChange = () => autosaver.markDirty('buildings');
  const progression = new Progression(profileState, () => autosaver.markDirty('profiles'));

  const bSave = await loadKey('buildings');
  if (bSave && bSave.initialized) buildings.load(bSave);
  else {
    // a new village starts with an unfinished Well and Hut on the plaza
    const y = world.plazaHeight + 1;
    buildings.place(BUILDING_BY_ID.well, 67, y, 59);
    buildings.place(BUILDING_BY_ID.hut, 56, y, 58);
  }

  const scene = new THREE.Scene();
  const sky = createSky(scene);
  const lighting = createLighting(scene);
  const chunkRenderer = new ChunkRenderer(world, scene, materials);
  chunkRenderer.buildAll();

  // --- player, avatar, camera ---
  const profile = CONFIG.players.find((p) => p.id === profileId) || CONFIG.players[0];
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

  let mode = 'play'; // 'play' | 'placing' | 'celebrating' | 'dialog'
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
    onBuild: () => openCatalogue(),
    onCancelPlacement: () => cancelPlacement(),
  });
  const iconRenderer = createBlockIconRenderer(atlas, 56);
  const buildingIcons = createBuildingIconRenderer(atlas);
  const hotbar = createHotbar(hudEl, iconRenderer, HOTBAR_DEFAULT, () => audio.tap());
  const progressBar = createProgressBar(hudEl);
  const overlays = createOverlays(hudEl);
  const catalogue = createCatalogue(hudEl, {
    icons: buildingIcons, progression, audio,
    onPick: (b) => startPlacement(b),
    onNeedGems: () => hud.flashGems(),
    onOpen: () => touch.releaseAll(),
  });
  let shownGems = profileState.gems;
  hud.setLevel(progression.level, progression.progress.frac);
  hud.setGems(shownGems);
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
  function targetAt(sx, sy, maxReach = CONFIG.player.reach) {
    ndc.set((sx / R.width) * 2 - 1, -(sy / R.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const eye = player.eye();
    const camDist = Math.hypot(o.x - eye.x, o.y - eye.y, o.z - eye.z);
    const hit = raycastVoxels(getBlock, o.x, o.y, o.z, d.x, d.y, d.z, camDist + maxReach + 1, targetable);
    if (!hit) return null;
    hit.eyeDist = Math.hypot(hit.x + 0.5 - eye.x, hit.y + 0.5 - eye.y, hit.z + 0.5 - eye.z);
    if (hit.eyeDist > maxReach + 0.7) return null;
    return hit;
  }
  const projected = new THREE.Vector3();
  function toScreen(x, y, z) {
    projected.set(x, y, z).project(camera);
    return { x: ((projected.x + 1) / 2) * R.width, y: ((1 - projected.y) / 2) * R.height };
  }

  function tryPlace(hit) {
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

  // --- blueprints: fill, unfill, remove ---
  function showProgress(inst) {
    const t = buildings.type(inst);
    progressBar.show(t.name, buildings.placedCount(inst), t.voxels.length, inst.uid);
  }

  function fillGhost(hit) {
    const cell = buildings.cellAt(hit.x, hit.y, hit.z);
    if (!cell) { world.setBlock(hit.x, hit.y, hit.z, AIR, { recordAs: AIR }); return; }
    const r = buildings.fill(cell.inst, cell.i);
    if (!r) return;
    highlight.playFill(hit.x, hit.y, hit.z, r.id);
    particles.burst(hit.x, hit.y, hit.z, [1, 0.95, 0.7], 6);
    audio.tick(r.placed / r.total);
    showProgress(cell.inst);
    if (r.complete) completeBuilding(cell.inst);
  }

  function breakBlock(hit) {
    if (hit.y < CONFIG.world.digLimitY) return;
    const block = blockById(hit.id);
    const cell = buildings.cellAt(hit.x, hit.y, hit.z);
    if (cell) {
      if (cell.inst.complete) { askRemove(cell.inst); return; }
      if (!buildings.unfill(cell.inst, cell.i)) return;
      particles.burst(hit.x, hit.y, hit.z, atlas.avgColors[block.faces[0]] || [1, 1, 1], 10);
      audio.break(block.sound);
      showProgress(cell.inst);
      return;
    }
    if (!Number.isFinite(block.breakTime)) return;
    if (!world.setBlock(hit.x, hit.y, hit.z, AIR)) return;
    const [lo, hi] = CONFIG.particles.breakCount;
    particles.burst(hit.x, hit.y, hit.z, atlas.avgColors[block.faces[0]] || [1, 1, 1], lo + Math.floor(Math.random() * (hi - lo + 1)));
    audio.break(block.sound);
    hud.bump();
    rig.shake(0.05, 0.12);
  }

  async function askRemove(inst) {
    if (mode !== 'play') return;
    mode = 'dialog';
    holds.clear();
    highlight.setCrack(null, 0);
    touch.releaseAll();
    audio.tap();
    const yes = await overlays.confirmRemove();
    mode = 'play';
    if (!yes) return;
    const c = buildings.center(inst);
    const t = buildings.type(inst);
    buildings.remove(inst);
    for (let k = 0; k < 4; k++) {
      particles.burst(c.x - 0.5 + (Math.random() - 0.5) * t.size[0], inst.y + Math.random() * t.size[1], c.z - 0.5 + (Math.random() - 0.5) * t.size[2], [0.6, 0.6, 0.6], 12);
    }
    audio.break('stone');
    hud.bump();
    rig.shake(0.08, 0.2);
  }

  // --- placement flow ---
  let placing = null;
  function openCatalogue() {
    if (mode === 'placing') endPlacement();
    if (mode !== 'play' || paused) return;
    audio.tap();
    catalogue.open();
  }
  function startPlacement(type) {
    if (mode !== 'play') return;
    mode = 'placing';
    placing = { type, x0: null, y0: 0, z0: 0, valid: false };
    progressBar.hide();
    hud.showPlacement(type.name);
  }
  function groundYAt(hit) {
    if (isGround(hit.id)) return hit.y;
    let y = hit.y - 1;
    while (y > 1 && !isGround(world.getBlock(hit.x, y, hit.z))) y--;
    return y;
  }
  function updatePlacement() {
    const hit = targetAt(R.width / 2, R.height / 2, CONFIG.player.reach + 6);
    const [w, h, d] = placing.type.size;
    if (hit) {
      placing.x0 = hit.x - Math.floor(w / 2);
      placing.z0 = hit.z - Math.floor(d / 2);
      placing.y0 = groundYAt(hit) + 1;
    }
    if (placing.x0 === null) { highlight.hideFootprint(); return; }
    placing.valid = buildings.footprintValid(placing.type, placing.x0, placing.y0, placing.z0, player).ok;
    highlight.setFootprint(placing.x0, placing.y0, placing.z0, w, h, d, placing.valid);
  }
  function confirmPlacement() {
    if (!placing || placing.x0 === null || !placing.valid) { audio.error(); hud.shakePlacement(); return; }
    const inst = buildings.place(placing.type, placing.x0, placing.y0, placing.z0);
    endPlacement();
    audio.place('stone');
    rig.shake(0.03, 0.1);
    showProgress(inst);
  }
  function cancelPlacement() {
    if (mode !== 'placing') return;
    endPlacement();
    audio.tap();
  }
  function endPlacement() {
    mode = 'play';
    placing = null;
    highlight.hideFootprint();
    hud.hidePlacement();
  }

  // --- celebration ---
  let celebration = null;
  function completeBuilding(inst) {
    const type = buildings.type(inst);
    mode = 'celebrating';
    holds.clear();
    highlight.setCrack(null, 0);
    highlight.setTarget(null);
    touch.releaseAll();
    progressBar.hide();
    const award = progression.awardXp(type.rewardXp);
    progression.addGems(type.rewardGems);
    const c = buildings.center(inst);
    const [w, h, d] = type.size;
    rig.startOrbit(c.x, c.y, c.z, Math.max(w, d) * 1.2 + 5, h * 0.7 + 3);
    audio.jingle();
    const wool = CONFIG.palette.wool;
    for (let k = 0; k < 6; k++) {
      const hex = wool[Math.floor(Math.random() * wool.length)];
      const rgb = [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
      particles.burst(c.x - 0.5 + (Math.random() - 0.5) * w, inst.y + h + Math.random() * 2, c.z - 0.5 + (Math.random() - 0.5) * d, rgb, 10);
    }
    const ui = overlays.celebrate({ name: type.name, xp: type.rewardXp, gems: type.rewardGems });
    const cel = { inst, type, award, ui, start: performance.now(), gemsFlown: false, ended: false, timers: [] };
    celebration = cel;
    cel.timers.push(setTimeout(() => flyRewardGems(cel), 1700));
    cel.timers.push(setTimeout(() => hud.setLevel(award.after.level, award.after.frac), 2300));
    cel.timers.push(setTimeout(() => endCelebration(cel), 6000));
  }
  function flyRewardGems(cel) {
    if (cel.gemsFlown) return;
    cel.gemsFlown = true;
    const c = buildings.center(cel.inst);
    const from = toScreen(c.x, c.y, c.z);
    const to = hud.gemCounterPoint();
    overlays.flyGems(from.x, from.y, to.x, to.y, cel.type.rewardGems, () => { shownGems++; hud.setGems(shownGems); });
  }
  function dismissCelebration() {
    if (!celebration || performance.now() - celebration.start < 800) return;
    endCelebration(celebration);
  }
  async function endCelebration(cel) {
    if (cel.ended) return;
    cel.ended = true;
    for (const t of cel.timers) clearTimeout(t);
    flyRewardGems(cel);
    cel.ui.end();
    rig.stopOrbit();
    hud.setLevel(cel.award.after.level, cel.award.after.frac);
    celebration = null;
    mode = 'play';
    if (cel.award.leveledUp) {
      await new Promise((r) => setTimeout(r, 900));
      audio.fanfare();
      hud.levelBump();
      shownGems += cel.award.levelUpGems;
      hud.setGems(shownGems);
      await overlays.levelUp(cel.award.after.level);
    }
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
  function onTap(sx, sy) {
    if (paused) return;
    if (mode === 'celebrating') { dismissCelebration(); return; }
    if (mode === 'placing') { confirmPlacement(); return; }
    if (mode !== 'play') return;
    const hit = targetAt(sx, sy, CONFIG.player.reach + 3);
    if (!hit) return;
    if (hit.id === GHOST) { fillGhost(hit); return; }
    if (hit.eyeDist > CONFIG.player.reach + 0.7) return;
    tryPlace(hit);
  }
  const actions = {
    look: (dx, dy) => { if (mode !== 'celebrating') player.look(dx, dy, CONFIG.camera.lookDegPerPx); },
    lookMouse: (dx, dy) => { if (mode !== 'celebrating') player.look(dx, dy, CONFIG.camera.mouseDegPerPx); },
    tap: onTap,
    holdStart: (id, sx, sy) => { if (mode === 'play') holds.set(id, { sx, sy, centered: id === 'mouse', key: null, target: null, progress: 0 }); },
    holdMove: (id, sx, sy) => { const h = holds.get(id); if (h) { h.sx = sx; h.sy = sy; } },
    holdEnd: (id) => holds.delete(id),
    jumpDown: () => { player.requestJump(); player.jumpHeld = true; },
    jumpUp: () => { player.jumpHeld = false; },
    toggleFly: () => hud.setFlyMode(player.toggleFly()),
    toggleCamera: () => hud.setCameraMode(rig.toggle()),
    toggleDebug: () => debug.toggle(),
    escape: () => { if (catalogue.isOpen) catalogue.close(); else if (mode === 'placing') cancelPlacement(); else if (mode === 'celebrating') dismissCelebration(); else setPaused(!paused); },
    build: () => { if (catalogue.isOpen) catalogue.close(); else openCatalogue(); },
    selectSlot: (i) => hotbar.select(i),
    cycleSlot: (d) => hotbar.cycle(d),
    setKeyboardMove: (x, y) => { kbMove.x = x; kbMove.y = y; },
    setSprintKey: (v) => { player.sprintKey = v; },
    setDescend: (v) => { player.descendHeld = v; },
  };
  const touch = setupTouch({ canvas, joystick, actions });
  const desktop = setupDesktop({ canvas, actions });

  // --- storage persistence flag, meta ---
  let persisted = null;
  try {
    if (navigator.storage?.persist) persisted = await navigator.storage.persist();
  } catch { persisted = null; }
  debug.set('persisted', persisted);
  if (!meta.firstLaunch) meta.firstLaunch = Date.now();
  meta.persisted = persisted;
  meta.version = CONFIG.version;
  autosaver.markDirty('meta');
  document.addEventListener('visibilitychange', () => { if (document.hidden) touch.releaseAll(); });

  // --- service worker ---
  registerSW({ immediate: true });

  // --- game loop ---
  let started = false;
  let last = performance.now();
  let stepAcc = 0;
  let frameNo = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    frameNo++;
    if (!paused && started) {
      desktop.update();
      const inputOk = mode === 'play' || mode === 'placing';
      if (!inputOk) { player.move.x = 0; player.move.y = 0; }
      else if (joystick.active) { player.move.x = joyMove.x; player.move.y = joyMove.y; }
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
      if (mode === 'play') {
        updateHolds(dt);
        highlight.setTarget(targetAt(R.width / 2, R.height / 2, CONFIG.player.reach + 3));
        if (frameNo % 10 === 0) {
          const near = buildings.nearestUnfinished(player.x, player.z, 12);
          if (near) showProgress(near);
          else progressBar.hide();
        }
      } else if (mode === 'placing') {
        highlight.setTarget(null);
        updatePlacement();
      } else {
        highlight.setTarget(null);
      }
      highlight.update(dt);
      particles.update(dt);
      walls.update(player.x, player.z);
      debug.set('pos', `${player.x.toFixed(1)} ${player.y.toFixed(1)} ${player.z.toFixed(1)}  edits ${editCount}  mode ${mode}`);
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
  window.__bv = {
    world, player, rig, chunkRenderer, renderer, autosaver, atlas, actions, debug, targetAt, hotbar, scene,
    buildings, progression, catalogue, overlays, startPlacement, confirmPlacement, completeBuilding, get mode() { return mode; },
  };
}

boot().catch((e) => {
  console.error(e);
  startStatus.textContent = 'Something went wrong: ' + e.message;
});
