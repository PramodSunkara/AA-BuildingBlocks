import * as THREE from 'three';
import { CONFIG } from '../config.js';

// 20-minute day/night cycle driving sky, fog, hemisphere and sun. "Always day" pins mid-day.
export function createDayNight({ sky, lighting }) {
  const K = CONFIG.sky;
  const c = (hex) => new THREE.Color(hex);
  const NIGHT = { zenith: c(K.night.zenith), horizon: c(K.night.horizon), sun: 0.22, sunColor: c('#8090c0'), hemi: 0.35, ground: c('#1a2030') };
  const SUNSET = { zenith: c(K.sunset.zenith), horizon: c(K.sunset.horizon), sun: 1.2, sunColor: c('#ffb070'), hemi: 0.9, ground: c('#5a4a3a') };
  const DAY = { zenith: c(K.day.zenith), horizon: c(K.day.horizon), sun: CONFIG.render.sunIntensity, sunColor: c('#fff2dc'), hemi: CONFIG.render.hemiIntensity, ground: c('#6a7a3a') };
  const KEYS = [[0, NIGHT], [0.17, NIGHT], [0.25, SUNSET], [0.33, DAY], [0.7, DAY], [0.79, SUNSET], [0.87, NIGHT], [1, NIGHT]];
  const cur = { zenith: new THREE.Color(), horizon: new THREE.Color(), sunColor: new THREE.Color(), ground: new THREE.Color(), sun: 1, hemi: 1 };
  let t = 0.42, alwaysDay = true, lastApplied = -1;

  function sample(time) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const [t0, a] = KEYS[i], [t1, b] = KEYS[i + 1];
      if (time >= t0 && time <= t1) {
        const f = t1 === t0 ? 0 : (time - t0) / (t1 - t0);
        cur.zenith.copy(a.zenith).lerp(b.zenith, f);
        cur.horizon.copy(a.horizon).lerp(b.horizon, f);
        cur.sunColor.copy(a.sunColor).lerp(b.sunColor, f);
        cur.ground.copy(a.ground).lerp(b.ground, f);
        cur.sun = a.sun + (b.sun - a.sun) * f;
        cur.hemi = a.hemi + (b.hemi - a.hemi) * f;
        return;
      }
    }
  }

  function apply() {
    sample(t);
    sky.setColorsRGB(cur.zenith, cur.horizon);
    lighting.hemi.color.copy(cur.horizon);
    lighting.hemi.groundColor.copy(cur.ground);
    lighting.hemi.intensity = cur.hemi;
    lighting.sun.intensity = cur.sun;
    lighting.sun.color.copy(cur.sunColor);
  }

  return {
    update(dt) {
      const target = alwaysDay ? 0.42 : (t + dt / (K.cycleMinutes * 60)) % 1;
      t = target;
      if (Math.abs(t - lastApplied) > 0.0005) { apply(); lastApplied = t; }
    },
    setAlwaysDay(v) { alwaysDay = v; },
    get time() { return t; },
    set time(v) { t = v % 1; },
    get phase() { return t > 0.22 && t < 0.82 ? 'day' : 'night'; },
    get darkness() { return 1 - Math.min(1, Math.max(0, (cur.sun - 0.22) / (DAY.sun - 0.22))); },
  };
}
