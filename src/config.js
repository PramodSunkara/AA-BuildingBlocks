// All tunables live here. Distances are in blocks, times in seconds unless noted.
export const CONFIG = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  title: 'Block Village',

  players: [
    { id: 'p1', name: 'Atharv', shirt: '#7FC2F0', trousers: '#2B4A9E', hair: '#3B2A1A', skin: '#F1C9A5' },
    { id: 'p2', name: 'Avyaan', shirt: '#F2C230', trousers: '#3FA34D', hair: '#1E1E1E', skin: '#E8B98F' },
  ],

  world: {
    sizeX: 128,
    sizeZ: 128,
    height: 48,
    chunkSize: 16,
    chunksX: 8,
    chunksZ: 8,
    seed: 20260920,
    digLimitY: 1,
    plazaSize: 24,
    renderDistanceChunks: 6,
    wallFadeDistance: 3,
  },

  player: {
    width: 0.6,
    height: 1.8,
    eyeHeight: 1.62,
    walkSpeed: 4.3,
    sprintMultiplier: 1.6,
    sprintHoldMs: 3000,
    jumpHeight: 1.25,
    gravity: 28,
    flySpeed: 7,
    flyVerticalSpeed: 6,
    reach: 6,
    autoStep: true,
  },

  camera: {
    thirdDistance: 4.5,
    thirdPivotAboveEye: 0.5,
    thirdSideOffset: 0.45,
    smoothTime: 0.12,
    fov: 70,
    near: 0.1,
    far: 220,
    lookDegPerPx: 0.22,
    mouseDegPerPx: 0.14,
    pitchMax: 80,
    defaultPitch: -25,
  },

  input: {
    joystickOuter: 176,
    joystickKnob: 72,
    joystickDeadZone: 0.12,
    joystickRegion: 0.4,
    tapMs: 200,
    tapPx: 12,
    longPressMs: 350,
    doubleTapMs: 300,
  },

  render: {
    maxPixelRatio: 2,
    antialias: true,
    shadowMapSize: 2048,
    shadowBox: 48,
    fogStartFraction: 0.6,
    maxRemeshPerFrame: 2,
    aoLevels: [0.5, 0.68, 0.84, 1.0],
    faceShade: [0.9, 0.9, 1.0, 0.72, 0.86, 0.86],
    sunDirection: [0.45, 0.8, 0.32],
    sunIntensity: 2.0,
    hemiIntensity: 1.35,
  },

  palette: {
    grassTop: '#5FB33A', grassSide: '#7FA443', dirt: '#7A5230', stone: '#8E8E8E', cobble: '#7C7C7C',
    stoneBrick: '#A3A3A3', planks: '#B8863B', trunk: '#5C3F22', leaves: '#3E8E2C', apple: '#DD3333',
    blossom: '#FF88AA', roofing: '#8F4A1E', sand: '#E4D39A', water: '#3C82D6', glass: 'rgba(200,230,255,0.35)',
    glassFrame: '#F3F3F3',
    wool: ['#D9403A', '#F2C230', '#3A6FD8', '#3FA34D', '#8A4FC8', '#F2F2F2', '#7A4B2A', '#9CC8F0', '#F08AB8', '#F08A2A', '#2A2A2A'],
    woolNames: ['Red', 'Yellow', 'Blue', 'Green', 'Purple', 'White', 'Brown', 'Pale Blue', 'Pink', 'Orange', 'Black'],
  },

  sky: {
    day: { zenith: '#4F9BE8', horizon: '#BFE3FF' },
    sunset: { zenith: '#7A5FA8', horizon: '#F5A98B' },
    night: { zenith: '#0B1A3A', horizon: '#24406B' },
    cycleMinutes: 20,
  },

  particles: { breakCount: [12, 20], life: 0.6, gravity: 20 },

  autosaveDelayMs: 2000,
  saveVersion: 1,
};
