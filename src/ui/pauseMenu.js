import { gsap } from 'gsap';
import { iconSVG } from './icons.js';

// Pause menu: Resume / Switch player / Settings / Backup, with Settings and Backup sub-views.
export function createPauseMenu(container, { audio, version, getSettings, setSetting, onResume, onSwitch, onSaveFile, onLoadFile, getProtected }) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.id = 'pause';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="dialog panel pause-box">
      <div class="pause-view" data-view="main">
        <div class="pause-title">${iconSVG('pause', 28)} Paused</div>
        <div class="pause-grid">
          <div class="btn panel big" data-act="resume">${iconSVG('resume', 40)}<span class="lbl">Play</span></div>
          <div class="btn panel big" data-act="switch">${iconSVG('switch', 40)}<span class="lbl">Switch</span></div>
          <div class="btn panel big" data-act="settings">${iconSVG('gear', 40)}<span class="lbl">Settings</span></div>
          <div class="btn panel big" data-act="backup">${iconSVG('share', 40)}<span class="lbl">Backup</span></div>
        </div>
      </div>
      <div class="pause-view" data-view="settings" style="display:none">
        <div class="pause-title"><div class="btn panel small" data-act="back">${iconSVG('arrowUp', 24)}</div>${iconSVG('gear', 28)} Settings</div>
        <div class="rows">
          <div class="row" data-key="alwaysDay">${iconSVG('sun', 30)}<span>Always day</span><div class="switch"><div class="knob"></div></div></div>
          <div class="row" data-key="shadows">${iconSVG('shadow', 30)}<span>Shadows</span><div class="switch"><div class="knob"></div></div></div>
          <div class="row" data-key="sound">${iconSVG('speaker', 30)}<span>Sound</span><div class="switch"><div class="knob"></div></div></div>
          <div class="row" data-key="music">${iconSVG('music', 30)}<span>Music</span><div class="switch"><div class="knob"></div></div></div>
        </div>
      </div>
      <div class="pause-view" data-view="backup" style="display:none">
        <div class="pause-title"><div class="btn panel small" data-act="back">${iconSVG('arrowUp', 24)}</div>${iconSVG('share', 28)} Backup</div>
        <div class="pause-grid two">
          <div class="btn panel big" data-act="save">${iconSVG('share', 40)}<span class="lbl">Save file</span></div>
          <div class="btn panel big" data-act="load">${iconSVG('load', 40)}<span class="lbl">Load file</span></div>
        </div>
        <div class="backup-status"></div>
        <input type="file" class="file-input" accept=".bv,.json,application/json,application/octet-stream,application/gzip" />
      </div>
    </div>`;
  container.appendChild(el);
  const box = el.firstElementChild;
  const views = { main: el.querySelector('[data-view=main]'), settings: el.querySelector('[data-view=settings]'), backup: el.querySelector('[data-view=backup]') };
  const status = el.querySelector('.backup-status');
  const fileInput = el.querySelector('.file-input');
  let isOpen = false, view = 'main';

  function press(btn, fn) {
    let downAt = null;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); downAt = [e.clientX, e.clientY]; gsap.to(btn, { scale: 0.94, duration: 0.08 }); });
    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      gsap.to(btn, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' });
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) <= 14) fn(e);
      downAt = null;
    });
  }
  for (const btn of el.querySelectorAll('[data-act]')) {
    const act = btn.dataset.act;
    press(btn, () => {
      audio.tap();
      if (act === 'resume') close(onResume);
      else if (act === 'switch') close(onSwitch);
      else if (act === 'settings') show('settings');
      else if (act === 'backup') { refreshStatus(); show('backup'); }
      else if (act === 'back') show('main');
      else if (act === 'save') onSaveFile?.(setStatus);
      else if (act === 'load') fileInput.click();
    });
  }
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (f) onLoadFile?.(f, setStatus);
  });
  for (const row of el.querySelectorAll('.row')) {
    const key = row.dataset.key;
    const sw = row.querySelector('.switch');
    press(row, () => {
      const v = !getSettings()[key];
      setSetting(key, v);
      audio.tap();
      renderSwitch(sw, v, true);
    });
  }
  function renderSwitch(sw, on, animate) {
    sw.classList.toggle('on', on);
    if (animate) gsap.to(sw.querySelector('.knob'), { x: on ? 26 : 0, duration: 0.25, ease: 'back.out(2)' });
    else gsap.set(sw.querySelector('.knob'), { x: on ? 26 : 0 });
  }
  function refreshSwitches() {
    const s = getSettings();
    for (const row of el.querySelectorAll('.row')) renderSwitch(row.querySelector('.switch'), !!s[row.dataset.key], false);
  }
  function setStatus(text) {
    status.textContent = text;
    gsap.fromTo(status, { opacity: 0.4 }, { opacity: 1, duration: 0.3 });
  }
  function refreshStatus() {
    const p = getProtected();
    status.textContent = `Protected: ${p === true ? 'yes' : p === false ? 'no' : '?'}  ·  v${version}`;
  }
  function show(next) {
    if (next === view) return;
    const from = views[view], to = views[next];
    const dir = next === 'main' ? -1 : 1;
    view = next;
    gsap.to(from, { x: -40 * dir, opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: () => { from.style.display = 'none'; gsap.set(from, { x: 0, opacity: 1 }); } });
    to.style.display = '';
    gsap.fromTo(to, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25, delay: 0.12, ease: 'power2.out' });
  }
  function open() {
    if (isOpen) return;
    isOpen = true;
    refreshSwitches();
    for (const k of Object.keys(views)) { views[k].style.display = k === 'main' ? '' : 'none'; gsap.set(views[k], { x: 0, opacity: 1 }); }
    view = 'main';
    el.style.display = '';
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(box, { scale: 0.85, y: 20, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
  }
  function close(then) {
    if (!isOpen) return;
    isOpen = false;
    gsap.to(box, { scale: 0.85, opacity: 0, duration: 0.2, ease: 'power2.in' });
    gsap.to(el, { opacity: 0, duration: 0.2, onComplete: () => { el.style.display = 'none'; then?.(); } });
  }
  return { open, close, setStatus, get isOpen() { return isOpen; } };
}
