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

  return {
    unlock,
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
