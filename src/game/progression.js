import { levelProgress, LEVEL_UP_GEMS, MAX_LEVEL } from '../data/levels.js';

export function createProfileState(id) {
  return { id, xp: 0, gems: 0, unlocked: [], settings: { alwaysDay: true, shadows: true, sound: true, music: false } };
}

// Per-profile XP / level / gems / unlocks. Emits onChange for the autosaver.
export class Progression {
  constructor(profile, onChange) {
    this.profile = profile;
    this.onChange = onChange;
  }
  setProfile(profile) {
    this.profile = profile;
  }
  get level() {
    return levelProgress(this.profile.xp).level;
  }
  get progress() {
    return levelProgress(this.profile.xp);
  }
  get gems() {
    return this.profile.gems;
  }
  awardXp(n) {
    const before = levelProgress(this.profile.xp);
    this.profile.xp += n;
    const after = levelProgress(this.profile.xp);
    const levelsGained = after.level - before.level;
    if (levelsGained > 0) this.profile.gems += LEVEL_UP_GEMS * levelsGained;
    this.onChange?.();
    return { before, after, leveledUp: levelsGained > 0, levelsGained, levelUpGems: LEVEL_UP_GEMS * levelsGained };
  }
  addGems(n) {
    this.profile.gems += n;
    this.onChange?.();
  }
  isLevelLocked(building) {
    return this.level < building.level;
  }
  isUnlocked(building) {
    return !this.isLevelLocked(building) && (building.gemCost === 0 || this.profile.unlocked.includes(building.id));
  }
  canUnlock(building) {
    return !this.isLevelLocked(building) && this.profile.gems >= building.gemCost;
  }
  unlock(building) {
    if (this.isUnlocked(building)) return true;
    if (!this.canUnlock(building)) return false;
    this.profile.gems -= building.gemCost;
    this.profile.unlocked.push(building.id);
    this.onChange?.();
    return true;
  }
  get maxLevel() {
    return MAX_LEVEL;
  }
}
