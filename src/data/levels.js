// Total XP required to have reached level n (level 1 = 0). round(400 * (n-1)^1.6):
// level 2 = 400, level 3 = 1213, level 4 = 2320, level 5 = 3675, level 10 = 13540.
export const MAX_LEVEL = 10;
export const LEVEL_UP_GEMS = 5;

export function xpForLevel(n) {
  if (n <= 1) return 0;
  return Math.round(400 * Math.pow(n - 1, 1.6));
}

export function levelFromXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

// { level, frac (0..1 toward next), current, next }
export function levelProgress(xp) {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, frac: 1, current: xp, next: xpForLevel(MAX_LEVEL) };
  const lo = xpForLevel(level), hi = xpForLevel(level + 1);
  return { level, frac: Math.max(0, Math.min(1, (xp - lo) / (hi - lo))), current: xp, next: hi };
}
