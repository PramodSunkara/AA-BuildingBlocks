import * as THREE from 'three';

// 64x64 skin in the classic layout: head (0,0) 8x8x8, body (16,16) 8x12x4, right arm (40,16),
// left arm (32,48), right leg (0,16), left leg (16,48). Each part = 6 regions.
export const LAYOUT = {
  head: { u: 0, v: 0, w: 8, h: 8, d: 8 },
  body: { u: 16, v: 16, w: 8, h: 12, d: 4 },
  armR: { u: 40, v: 16, w: 4, h: 12, d: 4 },
  armL: { u: 32, v: 48, w: 4, h: 12, d: 4 },
  legR: { u: 0, v: 16, w: 4, h: 12, d: 4 },
  legL: { u: 16, v: 48, w: 4, h: 12, d: 4 },
};

export function regions(L) {
  const { u, v, w, h, d } = L;
  return {
    top: [u + d, v, w, d],
    bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h],
    front: [u + d, v + d, w, h],
    left: [u + d + w, v + d, d, h],
    back: [u + 2 * d + w, v + d, w, h],
  };
}

function shade(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

export function paintSkin(profile) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const fill = (r, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(r[0], r[1], r[2], r[3]);
  };
  const px = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  const all = (L, color) => {
    const R = regions(L);
    fill(R.top, shade(color, 1.05));
    fill(R.bottom, shade(color, 0.8));
    fill(R.right, shade(color, 0.92));
    fill(R.left, shade(color, 0.92));
    fill(R.front, color);
    fill(R.back, shade(color, 0.88));
  };

  // head: skin + hair cap
  all(LAYOUT.head, profile.skin);
  const H = regions(LAYOUT.head);
  fill(H.top, profile.hair);
  for (const k of ['right', 'left', 'front']) fill([H[k][0], H[k][1], H[k][2], 3], profile.hair);
  fill(H.back, profile.hair);
  // fringe wobble
  px(H.front[0] + 1, H.front[1] + 3, profile.hair);
  px(H.front[0] + 6, H.front[1] + 3, profile.hair);
  // eyes + mouth
  const fx = H.front[0], fy = H.front[1];
  px(fx + 1, fy + 4, '#FFFFFF'); px(fx + 2, fy + 4, '#2A2A2A');
  px(fx + 5, fy + 4, '#2A2A2A'); px(fx + 6, fy + 4, '#FFFFFF');
  px(fx + 3, fy + 6, shade(profile.skin, 0.75)); px(fx + 4, fy + 6, shade(profile.skin, 0.75));

  // body: shirt with a pocket/logo
  all(LAYOUT.body, profile.shirt);
  const B = regions(LAYOUT.body);
  fill([B.front[0] + 2, B.front[1] + 3, 4, 3], shade(profile.shirt, 0.85));
  fill([B.front[0] + 3, B.front[1] + 4, 2, 1], '#F2F2F2');

  // arms: short sleeves
  for (const key of ['armR', 'armL']) {
    all(LAYOUT[key], profile.skin);
    const R = regions(LAYOUT[key]);
    for (const k of ['right', 'left', 'front', 'back']) fill([R[k][0], R[k][1], R[k][2], 5], shade(profile.shirt, k === 'front' ? 1 : 0.9));
    fill(R.top, profile.shirt);
  }

  // legs: trousers + dark shoes
  for (const key of ['legR', 'legL']) {
    all(LAYOUT[key], profile.trousers);
    const R = regions(LAYOUT[key]);
    for (const k of ['right', 'left', 'front', 'back']) fill([R[k][0], R[k][1] + 10, R[k][2], 2], '#2A2A2A');
    fill(R.bottom, '#2A2A2A');
  }

  const texture = new THREE.CanvasTexture(cv);
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas: cv, texture };
}
