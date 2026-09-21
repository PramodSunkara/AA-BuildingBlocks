import { get, set } from 'idb-keyval';
import { KEYS } from './save.js';
import { CONFIG } from '../config.js';

export const BACKUP_FORMAT = 'block-village';
export const BACKUP_VERSION = 1;

// Typed arrays do not survive JSON; tag them so a backup round-trips exactly.
export function toPlain(v) {
  if (ArrayBuffer.isView(v)) return { __ta: v.constructor.name, d: Array.from(v) };
  if (Array.isArray(v)) return v.map(toPlain);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = toPlain(v[k]);
    return o;
  }
  return v;
}
const TA = { Uint8Array, Uint16Array, Uint32Array, Int16Array, Float32Array };
export function fromPlain(v) {
  if (Array.isArray(v)) return v.map(fromPlain);
  if (v && typeof v === 'object') {
    if (v.__ta && TA[v.__ta] && Array.isArray(v.d)) return TA[v.__ta].from(v.d);
    const o = {};
    for (const k of Object.keys(v)) o[k] = fromPlain(v[k]);
    return o;
  }
  return v;
}

export function migrateBackup(doc) {
  let v = doc.version || 1;
  while (v < BACKUP_VERSION) {
    switch (v) {
      default:
        v++;
    }
  }
  doc.version = BACKUP_VERSION;
  return doc;
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// Reads every save key from IndexedDB and packs them into one (gzip when available) .bv file.
export async function buildBackup() {
  const data = {};
  for (const k of Object.keys(KEYS)) {
    const v = await get(KEYS[k]);
    if (v !== undefined) data[k] = toPlain(v);
  }
  const doc = { format: BACKUP_FORMAT, version: BACKUP_VERSION, app: CONFIG.version, exportedAt: new Date().toISOString(), data };
  const json = JSON.stringify(doc);
  let blob, gzipped = false;
  if (typeof CompressionStream === 'function') {
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      blob = await new Response(stream).blob();
      gzipped = true;
    } catch { blob = null; }
  }
  if (!blob) blob = new Blob([json], { type: 'application/json' });
  return { blob: new Blob([blob], { type: 'application/octet-stream' }), name: `block-village-${stamp()}.bv`, gzipped, bytes: blob.size };
}

// Web Share (to Files / iCloud Drive) when files are supported, otherwise a download link.
export async function shareBackup(blob, name) {
  const file = new File([blob], name, { type: 'application/octet-stream' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Block Village backup' });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export async function parseBackup(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('gzip not supported');
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(buf);
  }
  const doc = JSON.parse(text);
  if (!doc || doc.format !== BACKUP_FORMAT || !doc.data) throw new Error('not a Block Village backup');
  migrateBackup(doc);
  return doc;
}

// Replaces every save key with the backup's content. Caller reloads the page afterwards.
export async function applyBackup(doc) {
  for (const k of Object.keys(KEYS)) {
    if (doc.data[k] !== undefined) await set(KEYS[k], fromPlain(doc.data[k]));
  }
}
