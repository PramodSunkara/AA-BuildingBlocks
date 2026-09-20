import { get, set } from 'idb-keyval';
import { CONFIG } from '../config.js';

export const KEYS = {
  world: 'bv:world',
  meta: 'bv:meta',
  buildings: 'bv:buildings',
  profiles: 'bv:profiles',
  life: 'bv:life',
  custom: 'bv:custom',
};

export async function loadKey(key) {
  try {
    return await get(KEYS[key]);
  } catch (e) {
    console.warn('load failed', key, e);
    return undefined;
  }
}

// Versioned save schema. Bump CONFIG.saveVersion and add a case here when the format changes.
export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  let v = data.version || 1;
  while (v < CONFIG.saveVersion) {
    switch (v) {
      default:
        v++;
    }
  }
  data.version = CONFIG.saveVersion;
  return data;
}

export function serializeWorld(world) {
  const chunks = [];
  for (const c of world.chunks) {
    if (c.edits.size === 0) continue;
    const idx = new Uint16Array(c.edits.size);
    const ids = new Uint8Array(c.edits.size);
    let i = 0;
    for (const [k, v] of c.edits) {
      idx[i] = k;
      ids[i] = v;
      i++;
    }
    chunks.push({ cx: c.cx, cz: c.cz, idx, ids });
  }
  return { version: CONFIG.saveVersion, seed: world.seed, savedAt: Date.now(), chunks };
}

export function applyWorldSave(world, data) {
  if (!data || !Array.isArray(data.chunks)) return 0;
  let n = 0;
  for (const rec of data.chunks) {
    const c = world.chunkAt(rec.cx, rec.cz);
    if (!c) continue;
    for (let i = 0; i < rec.idx.length; i++) {
      c.data[rec.idx[i]] = rec.ids[i];
      c.edits.set(rec.idx[i], rec.ids[i]);
      n++;
    }
  }
  return n;
}

export async function loadWorldSave() {
  try {
    return migrate(await get(KEYS.world));
  } catch (e) {
    console.warn('load failed', e);
    return null;
  }
}

export async function loadMeta() {
  try {
    return (await get(KEYS.meta)) || {};
  } catch {
    return {};
  }
}
export async function saveMeta(meta) {
  try {
    await set(KEYS.meta, meta);
  } catch (e) {
    console.warn('meta save failed', e);
  }
}

// Debounced autosave for several keys: 2 s after the last change, plus immediately when the
// page is hidden/unloaded. savers: { key: () => serializable }.
export function createAutosaver({ delayMs, savers, onSaved }) {
  let timer = null, saving = false, queued = false;
  const dirty = new Set();
  const flush = async () => {
    clearTimeout(timer);
    timer = null;
    if (dirty.size === 0) return;
    if (saving) {
      queued = true;
      return;
    }
    saving = true;
    const keys = [...dirty];
    dirty.clear();
    try {
      for (const k of keys) if (!KEYS[k] || !savers[k]) throw new Error('unknown save key ' + k);
      await Promise.all(keys.map((k) => set(KEYS[k], savers[k]())));
      onSaved?.(true, keys);
    } catch (e) {
      console.warn('save failed', e);
      for (const k of keys) dirty.add(k);
      onSaved?.(false, keys);
    }
    saving = false;
    if (queued) {
      queued = false;
      flush();
    }
  };
  const markDirty = (key) => {
    dirty.add(key);
    clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  window.addEventListener('pagehide', flush);
  return { flush, markDirty, isDirty: () => dirty.size > 0 };
}
