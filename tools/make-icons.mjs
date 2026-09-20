// Generates public/icon-192.png, public/icon-512.png and public/apple-touch-icon.png
// from a 32x32 pixel-art drawing. No dependencies: PNG is encoded with node:zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const ART = 32;
const px = new Uint8Array(ART * ART * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function set(x, y, color) {
  if (x < 0 || y < 0 || x >= ART || y >= ART) return;
  const [r, g, b] = hex(color);
  const i = (y * ART + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
}
// background: sky with rounded corners
for (let y = 0; y < ART; y++) for (let x = 0; x < ART; x++) {
  const cx = Math.min(x, ART - 1 - x), cy = Math.min(y, ART - 1 - y);
  const corner = cx < 4 && cy < 4 && (cx + cy) < 3;
  if (!corner) set(x, y, y < 20 ? '#4F9BE8' : '#BFE3FF');
}
// ground strip
for (let y = 26; y < ART; y++) for (let x = 0; x < ART; x++) {
  const cx = Math.min(x, ART - 1 - x), cy = ART - 1 - y;
  if (cx < 4 && cy < 4 && (cx + cy) < 3) continue;
  set(x, y, y === 26 ? '#5FB33A' : '#7A5230');
}
// isometric grass block, centre (16, 15), half width 9, half height 5, face height 9
const C = { x: 16, y: 13 }, HW = 9, HH = 5, FH = 9;
for (let y = 0; y < ART; y++) for (let x = 0; x < ART; x++) {
  const dx = x + 0.5 - C.x, dy = y + 0.5 - C.y;
  const inTop = Math.abs(dx) / HW + Math.abs(dy) / HH <= 1;
  if (inTop) { set(x, y, (x + y) % 5 === 0 ? '#78C84E' : '#5FB33A'); continue; }
  // side faces: below the lower edges of the rhombus
  const lowerEdge = C.y + HH * (1 - Math.abs(dx) / HW);
  if (Math.abs(dx) <= HW && y + 0.5 > lowerEdge && y + 0.5 <= lowerEdge + FH) {
    const grassBand = y + 0.5 <= lowerEdge + 2.5;
    if (dx < 0) set(x, y, grassBand ? '#7FA443' : ((x * 7 + y * 3) % 11 === 0 ? '#5E3D22' : '#7A5230'));
    else set(x, y, grassBand ? '#6E9138' : ((x * 5 + y * 7) % 13 === 0 ? '#4E3319' : '#66442A'));
  }
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * ART), sy = Math.floor((y / size) * ART);
      const si = (sy * ART + sx) * 4, di = y * (size * 4 + 1) + 1 + x * 4;
      raw[di] = px[si]; raw[di + 1] = px[si + 1]; raw[di + 2] = px[si + 2]; raw[di + 3] = px[si + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
writeFileSync(new URL('../public/icon-192.png', import.meta.url), encodePNG(192));
writeFileSync(new URL('../public/icon-512.png', import.meta.url), encodePNG(512));
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), encodePNG(180));
console.log('icons written');
