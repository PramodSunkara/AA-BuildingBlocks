// Small synthesised sound set routed through one master gain. Created/resumed on the first tap.
const PITCH = { wood: 220, stone: 150, grass: 300, sand: 200, glass: 700, leaves: 420, cloth: 260, water: 330 };
const CUTOFF = { wood: 900, stone: 500, grass: 1400, sand: 1100, glass: 3500, leaves: 1800, cloth: 700, water: 1200 };

export function createAudio() {
  let ctx = null, master = null, noise = null, muted = false;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    ctx.resume();
  }

  document.addEventListener('visibilitychange', () => {
    if (!master) return;
    master.gain.value = document.hidden || muted ? 0 : 0.5;
  });

  function env(gain, t0, peak, decay) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  }

  function tone(freq, type, peak, decay, slide = 0) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + decay);
    env(g, t, peak, decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  function burst(cutoff, peak, decay, q = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, peak, decay);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + decay + 0.02);
  }

  function sweep(f0, f1, type, peak, dur, cutoff = 8000, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function vibrato(freq, type, peak, dur, depth, rate, cutoff = 4000) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.type = type;
    const steps = Math.floor(dur * rate * 2);
    for (let i = 0; i <= steps; i++) o.frequency.setValueAtTime(freq * (1 + (i % 2 ? depth : -depth)), t + (i / (rate * 2)));
    env(g, t, peak, dur);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // --- ambient birds / crickets ---
  let ambientMode = 'none', ambientTimer = null;
  function scheduleAmbient() {
    clearTimeout(ambientTimer);
    if (ambientMode === 'none' || !ctx) return;
    if (ambientMode === 'day') {
      const n = 2 + Math.floor(Math.random() * 3);
      const base = 2200 + Math.random() * 1200;
      for (let i = 0; i < n; i++) sweep(base, base * (1 + (Math.random() - 0.3) * 0.5), 'sine', 0.035, 0.09, 8000, i * 0.13);
      ambientTimer = setTimeout(scheduleAmbient, 1500 + Math.random() * 4000);
    } else {
      for (let i = 0; i < 6; i++) sweep(4300, 4300, 'sine', 0.02, 0.03, 8000, i * 0.06);
      ambientTimer = setTimeout(scheduleAmbient, 700 + Math.random() * 1500);
    }
  }

  const ANIMAL = {
    chicken: () => { for (let i = 0; i < 3; i++) { sweep(900, 650, 'square', 0.06, 0.08, 1800, i * 0.14); } },
    cow: () => sweep(170, 115, 'sawtooth', 0.2, 0.7, 600),
    pig: () => { sweep(320, 260, 'square', 0.09, 0.12, 900); sweep(280, 340, 'square', 0.09, 0.14, 900, 0.16); burst(700, 0.08, 0.12); },
    sheep: () => vibrato(380, 'triangle', 0.16, 0.55, 0.06, 9, 2500),
    dog: () => { sweep(260, 180, 'square', 0.12, 0.1, 700); burst(500, 0.12, 0.08); sweep(260, 180, 'square', 0.12, 0.1, 700, 0.18); },
    cat: () => { sweep(600, 950, 'sine', 0.12, 0.25); sweep(950, 500, 'sine', 0.12, 0.3, 8000, 0.25); },
    horse: () => vibrato(650, 'sawtooth', 0.12, 0.6, 0.12, 12, 1600),
    rabbit: () => { sweep(1800, 2300, 'sine', 0.07, 0.06); sweep(1800, 2300, 'sine', 0.07, 0.06, 8000, 0.1); },
  };

  return {
    unlock,
    setAmbient(mode) {
      if (mode === ambientMode) return;
      ambientMode = mode;
      scheduleAmbient();
    },
    animal(species) {
      ANIMAL[species]?.();
    },
    poof() {
      burst(1800, 0.15, 0.2);
      sweep(500, 200, 'sine', 0.1, 0.2);
    },
    door() {
      burst(1200, 0.15, 0.08);
      tone(180, 'triangle', 0.15, 0.1, -40);
    },
    saved() {
      tone(660, 'sine', 0.15, 0.12); tone(880, 'sine', 0.15, 0.2, 0);
      setTimeout(() => tone(1320, 'sine', 0.12, 0.4), 120);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    place(group) {
      tone((PITCH[group] || 220) * (0.95 + Math.random() * 0.1), 'triangle', 0.35, 0.12, -40);
      burst((CUTOFF[group] || 900), 0.12, 0.05);
    },
    break(group) {
      burst((CUTOFF[group] || 900) * 0.8, 0.4, 0.22, 0.7);
      tone((PITCH[group] || 200) * 0.6, 'square', 0.08, 0.08, -60);
    },
    // ghost fill: short tick plus a tone that rises with build progress (0..1)
    tick(progress = 0) {
      tone(500 + 700 * progress, 'triangle', 0.18, 0.12, 120);
      burst(2500, 0.08, 0.03);
    },
    // ~3 s celebration jingle
    jingle() {
      if (!ctx) return;
      const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      notes.forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.22, i === notes.length - 1 ? 1.2 : 0.35), i * 220));
      setTimeout(() => { tone(1047, 'sine', 0.12, 1.4); tone(1319, 'sine', 0.1, 1.4); }, 1900);
    },
    // level-up fanfare
    fanfare() {
      if (!ctx) return;
      const notes = [392, 523, 659, 784];
      notes.forEach((f, i) => setTimeout(() => { tone(f, 'square', 0.12, 0.28); tone(f * 2, 'triangle', 0.1, 0.28); }, i * 130));
      setTimeout(() => { tone(1047, 'square', 0.14, 0.9); tone(1319, 'triangle', 0.1, 0.9); }, 560);
    },
    error() {
      tone(220, 'square', 0.1, 0.12, -60);
    },
    tap() {
      tone(880, 'sine', 0.12, 0.05, 200);
    },
    step(group) {
      burst((CUTOFF[group] || 900) * 0.7, 0.06, 0.07);
    },
    land() {
      burst(500, 0.18, 0.12);
    },
  };
}
