// Block and atlas-tile definitions. Tile indices address the 16x16 atlas (see render/atlas.js).
export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, STONE_BRICK: 5, SAND: 6,
  SANDSTONE_SIDE: 7, SANDSTONE_TOP: 8, OAK_SIDE: 9, OAK_TOP: 10, PLANKS: 11,
  LEAVES: 12, LEAVES_APPLE: 13, LEAVES_FLOWER: 14, ROOF: 15,
  GLASS: 16, GLASS_FRAME: 17, BEDROCK: 18, WATER: 19, TORCH: 20, FENCE: 21, GHOST: 22, GRASS_TUFT: 23,
  FLOWER_RED: 24, FLOWER_YELLOW: 25, FLOWER_BLUE: 26, WHEAT_1: 27, WHEAT_2: 28, WHEAT_3: 29,
  PUMPKIN_SIDE: 30, PUMPKIN_TOP: 31, PUMPKIN_FACE: 32, MUSHROOM: 33, CACTUS_SIDE: 34, CACTUS_TOP: 35,
  WOOL_0: 36, // 36..46 are the 11 wool colours
  CRACK_0: 48, CRACK_1: 49, CRACK_2: 50, CRACK_3: 51,
  DOOR_BOTTOM: 52, DOOR_TOP: 53, PICTURE: 54, CLOCK: 55, BOOKS: 56, DARK_PLANKS: 57,
};

export const SHAPE = { CUBE: 0, CROSS: 1, FENCE: 2, TORCH: 3, MODEL: 4 };
export const GROUP = { OPAQUE: 0, CUTOUT: 1, TRANSPARENT: 2 };

export const BLOCKS = [];

function def(id, name, opts) {
  const b = {
    id, name, pack: 'base', shape: SHAPE.CUBE, solid: true, opaque: true, group: GROUP.OPAQUE,
    cullSame: false, breakTime: 0.35, sound: 'stone', inventory: true, replaceable: false, tile: 0,
    ...opts,
  };
  // faces: [+x, -x, +y, -y, +z, -z]
  if (!b.faces) {
    const side = b.side ?? b.tile, top = b.top ?? side, bottom = b.bottom ?? top;
    b.faces = [side, side, top, bottom, side, side];
  }
  BLOCKS[id] = b;
  return b;
}

export const AIR = 0;
def(AIR, 'Air', { solid: false, opaque: false, inventory: false, replaceable: true });
def(1, 'Grass', { side: TILE.GRASS_SIDE, top: TILE.GRASS_TOP, bottom: TILE.DIRT, sound: 'grass' });
def(2, 'Dirt', { tile: TILE.DIRT, sound: 'grass' });
def(3, 'Stone', { tile: TILE.STONE, breakTime: 0.6 });
def(4, 'Cobblestone', { tile: TILE.COBBLE, breakTime: 0.6 });
def(5, 'Stone Brick', { tile: TILE.STONE_BRICK, breakTime: 0.6 });
def(6, 'Sand', { tile: TILE.SAND, sound: 'sand' });
def(7, 'Sandstone', { side: TILE.SANDSTONE_SIDE, top: TILE.SANDSTONE_TOP, breakTime: 0.5 });
def(8, 'Oak Trunk', { side: TILE.OAK_SIDE, top: TILE.OAK_TOP, sound: 'wood', breakTime: 0.45 });
def(9, 'Planks', { tile: TILE.PLANKS, sound: 'wood' });
def(10, 'Leaves', { tile: TILE.LEAVES, sound: 'leaves', breakTime: 0.25 });
def(11, 'Apple Leaves', { tile: TILE.LEAVES_APPLE, sound: 'leaves', breakTime: 0.25 });
def(12, 'Flower Leaves', { tile: TILE.LEAVES_FLOWER, sound: 'leaves', breakTime: 0.25 });
def(13, 'Roofing', { tile: TILE.ROOF, sound: 'wood' });
def(14, 'Glass', { tile: TILE.GLASS, opaque: false, group: GROUP.TRANSPARENT, cullSame: true, sound: 'glass', breakTime: 0.3 });
def(15, 'Fence', { tile: TILE.FENCE, shape: SHAPE.FENCE, opaque: false, sound: 'wood' });
def(16, 'Torch', { tile: TILE.TORCH, shape: SHAPE.TORCH, opaque: false, solid: false, group: GROUP.CUTOUT, sound: 'wood', breakTime: 0.2, light: true });
def(17, 'Bedrock', { tile: TILE.BEDROCK, breakTime: Infinity, inventory: false });

export const WOOL_FIRST = 18;
const WOOL_NAMES = ['Red', 'Yellow', 'Blue', 'Green', 'Purple', 'White', 'Brown', 'Pale Blue', 'Pink', 'Orange', 'Black'];
for (let i = 0; i < 11; i++) {
  def(WOOL_FIRST + i, WOOL_NAMES[i] + ' Wool', { tile: TILE.WOOL_0 + i, pack: 'colors', sound: 'cloth', breakTime: 0.3 });
}

export const WATER = 29;
def(WATER, 'Water', { tile: TILE.WATER, pack: 'nature', opaque: false, solid: false, group: GROUP.TRANSPARENT, cullSame: true, replaceable: true, breakTime: 0.2, sound: 'water', liquid: true });
def(30, 'Red Flower', { tile: TILE.FLOWER_RED, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, replaceable: true, breakTime: 0.1, sound: 'grass' });
def(31, 'Yellow Flower', { tile: TILE.FLOWER_YELLOW, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, replaceable: true, breakTime: 0.1, sound: 'grass' });
def(32, 'Blue Flower', { tile: TILE.FLOWER_BLUE, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, replaceable: true, breakTime: 0.1, sound: 'grass' });
def(33, 'Wheat', { tile: TILE.WHEAT_1, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, breakTime: 0.1, sound: 'grass', growsTo: 34 });
def(34, 'Wheat', { tile: TILE.WHEAT_2, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, breakTime: 0.1, sound: 'grass', inventory: false, growsTo: 35 });
def(35, 'Wheat', { tile: TILE.WHEAT_3, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, breakTime: 0.1, sound: 'grass', inventory: false });
def(36, 'Pumpkin', { faces: [TILE.PUMPKIN_SIDE, TILE.PUMPKIN_SIDE, TILE.PUMPKIN_TOP, TILE.PUMPKIN_TOP, TILE.PUMPKIN_SIDE, TILE.PUMPKIN_FACE], pack: 'nature', sound: 'wood' });
def(37, 'Mushroom', { tile: TILE.MUSHROOM, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, replaceable: true, breakTime: 0.1, sound: 'grass' });
def(38, 'Cactus', { side: TILE.CACTUS_SIDE, top: TILE.CACTUS_TOP, pack: 'nature', sound: 'cloth' });
export const GRASS_TUFT = 39;
def(GRASS_TUFT, 'Grass Tuft', { tile: TILE.GRASS_TUFT, pack: 'nature', shape: SHAPE.CROSS, opaque: false, solid: false, group: GROUP.CUTOUT, replaceable: true, breakTime: 0.1, sound: 'grass', inventory: false });

// Ghost block: translucent placeholder for an unbuilt blueprint voxel. Never saved as a world edit.
export const GHOST = 40;
def(GHOST, 'Ghost', { tile: TILE.GHOST, opaque: false, solid: false, group: GROUP.TRANSPARENT, cullSame: true, breakTime: Infinity, inventory: false, sound: 'glass' });

export const GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, STONE_BRICK = 5, SAND = 6, OAK_TRUNK = 8, PLANKS = 9;
export const LEAVES = 10, APPLE_LEAVES = 11, FLOWER_LEAVES = 12, ROOFING = 13, GLASS = 14, FENCE = 15, TORCH = 16, BEDROCK = 17;
export const FLOWER_RED = 30, FLOWER_YELLOW = 31, FLOWER_BLUE = 32, WHEAT_1 = 33, PUMPKIN = 36;

// ---------- Furniture: models built from sub-boxes (block-local 0..1 units) ----------
const S = 1 / 16;
// tiles: [+x, -x, +y, -y, +z, -z]
function box(lo, hi, tiles) {
  return { lo, hi, tiles: Array.isArray(tiles) ? tiles : [tiles, tiles, tiles, tiles, tiles, tiles] };
}
// Rotate a model 90 degrees about +y so a front facing +z faces +x: (x,z) -> (z, 1-x).
function rotateModel(model) {
  return model.map((b) => {
    const xs = [b.lo[2], b.hi[2]], zs = [1 - b.lo[0], 1 - b.hi[0]];
    const t = b.tiles;
    return { lo: [Math.min(...xs), b.lo[1], Math.min(...zs)], hi: [Math.max(...xs), b.hi[1], Math.max(...zs)], tiles: [t[4], t[5], t[2], t[3], t[1], t[0]] };
  });
}
export const FACING_DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // facing 0..3 -> front direction (x, z)

function defModel(id, name, model, opts = {}) {
  return def(id, name, { shape: SHAPE.MODEL, opaque: false, model, pack: 'furniture', sound: 'wood', breakTime: 0.3, ...opts });
}
// Four orientation variants: ids base..base+3; only facing 0 is in the inventory.
function defOriented(base, name, model, opts = {}) {
  let m = model;
  const variants = [base, base + 1, base + 2, base + 3];
  for (let f = 0; f < 4; f++) {
    const b = defModel(base + f, name, m, { ...opts, facing: f, base, inventory: f === 0 && opts.inventory !== false });
    b.variants = variants;
    m = rotateModel(m);
  }
}

const P = TILE.PLANKS, DP = TILE.DARK_PLANKS, WW = TILE.WOOL_0 + 5, WR = TILE.WOOL_0;
export const TABLE = 41;
defModel(TABLE, 'Table', [
  box([0, 12 * S, 0], [1, 14 * S, 1], P),
  box([1 * S, 0, 1 * S], [3 * S, 12 * S, 3 * S], DP), box([13 * S, 0, 1 * S], [15 * S, 12 * S, 3 * S], DP),
  box([1 * S, 0, 13 * S], [3 * S, 12 * S, 15 * S], DP), box([13 * S, 0, 13 * S], [15 * S, 12 * S, 15 * S], DP),
]);
export const BENCH = 42;
defOriented(BENCH, 'Bench', [
  box([0, 6 * S, 4 * S], [1, 8 * S, 12 * S], P),
  box([1 * S, 0, 5 * S], [3 * S, 6 * S, 11 * S], DP), box([13 * S, 0, 5 * S], [15 * S, 6 * S, 11 * S], DP),
  box([0, 8 * S, 4 * S], [1, 15 * S, 6 * S], P),
]);
export const BED = 46;
defOriented(BED, 'Bed', [
  box([0, 0, 0], [1, 5 * S, 1], DP),
  box([1 * S, 5 * S, 0], [15 * S, 9 * S, 1], WW),
  box([1 * S, 9 * S, 0], [15 * S, 10 * S, 10 * S], WR),
  box([2 * S, 9 * S, 11 * S], [14 * S, 11 * S, 15 * S], WW),
], { sound: 'cloth' });
export const SHELF = 50;
defOriented(SHELF, 'Shelf', [
  box([0, 0, 0], [1, 1, 2 * S], DP),
  box([0, 5 * S, 2 * S], [1, 6 * S, 10 * S], P), box([0, 11 * S, 2 * S], [1, 12 * S, 10 * S], P),
  box([1 * S, 6 * S, 3 * S], [12 * S, 10 * S, 9 * S], [TILE.BOOKS, TILE.BOOKS, TILE.BOOKS, TILE.BOOKS, TILE.BOOKS, TILE.BOOKS]),
  box([3 * S, 12 * S, 3 * S], [15 * S, 15 * S, 9 * S], [TILE.BOOKS, TILE.BOOKS, TILE.BOOKS, TILE.BOOKS, TILE.BOOKS, TILE.BOOKS]),
]);
export const CHANDELIER = 54;
defModel(CHANDELIER, 'Chandelier', [
  box([7 * S, 12 * S, 7 * S], [9 * S, 1, 9 * S], DP),
  box([3 * S, 5 * S, 3 * S], [13 * S, 7 * S, 5 * S], P), box([3 * S, 5 * S, 11 * S], [13 * S, 7 * S, 13 * S], P),
  box([3 * S, 5 * S, 5 * S], [5 * S, 7 * S, 11 * S], P), box([11 * S, 5 * S, 5 * S], [13 * S, 7 * S, 11 * S], P),
  box([3 * S, 7 * S, 3 * S], [5 * S, 12 * S, 5 * S], TILE.TORCH), box([11 * S, 7 * S, 3 * S], [13 * S, 12 * S, 5 * S], TILE.TORCH),
  box([3 * S, 7 * S, 11 * S], [5 * S, 12 * S, 13 * S], TILE.TORCH), box([11 * S, 7 * S, 11 * S], [13 * S, 12 * S, 13 * S], TILE.TORCH),
], { solid: false, group: GROUP.CUTOUT, light: true });
export const PICTURE = 55;
defOriented(PICTURE, 'Picture', [
  box([2 * S, 2 * S, 0], [14 * S, 14 * S, 1 * S], [DP, DP, DP, DP, TILE.PICTURE, DP]),
], { solid: false, wall: true });
export const CLOCK = 59;
defOriented(CLOCK, 'Clock', [
  box([3 * S, 3 * S, 0], [13 * S, 13 * S, 1 * S], [DP, DP, DP, DP, TILE.CLOCK, DP]),
], { solid: false, wall: true });

// Doors: two blocks tall, panel along x or z, closed or open (open = walkable).
export const DOOR = 63; // closed, along x, bottom half = the inventory item
const doorTiles = (axis, open, top) => {
  const t = top ? TILE.DOOR_TOP : TILE.DOOR_BOTTOM;
  const alongX = (axis === 'x') !== open; // open doors swing 90 degrees
  return alongX ? [DP, DP, DP, DP, t, t] : [t, t, DP, DP, DP, DP];
};
const doorBox = (axis, open) => {
  const alongX = (axis === 'x') !== open;
  if (alongX) return open ? [[0, 0, 0], [1, 1, 2 * S]] : [[0, 0, 7 * S], [1, 1, 9 * S]];
  return open ? [[0, 0, 0], [2 * S, 1, 1]] : [[7 * S, 0, 0], [9 * S, 1, 1]];
};
let doorId = DOOR;
for (const axis of ['x', 'z']) {
  for (const open of [false, true]) {
    for (const top of [false, true]) {
      const [lo, hi] = doorBox(axis, open);
      const id = doorId++;
      defModel(id, 'Door', [box(lo, hi, doorTiles(axis, open, top))], {
        solid: !open, inventory: id === DOOR, door: { axis, open, top },
      });
    }
  }
}
// door partner lookup: (axis, open, top) -> id
export function doorId3(axis, open, top) {
  return DOOR + (axis === 'z' ? 4 : 0) + (open ? 2 : 0) + (top ? 1 : 0);
}

// ---------- Animals are placeable items, not blocks ----------
export const ANIMAL_SPECIES = ['chicken', 'cow', 'pig', 'sheep', 'dog', 'cat', 'horse', 'rabbit'];
export const ANIMAL_ITEMS = ANIMAL_SPECIES.map((s) => ({ id: 'animal:' + s, kind: 'animal', species: s, name: s[0].toUpperCase() + s.slice(1), pack: 'animals' }));
export const PACKS = ['base', 'colors', 'nature', 'furniture', 'animals'];
export function itemsInPack(pack) {
  if (pack === 'animals') return ANIMAL_ITEMS;
  return blocksInPack(pack).map((b) => b.id);
}
export const isAnimalItem = (item) => typeof item === 'string' && item.startsWith('animal:');

// Default hotbar for the Base pack (Stage 1).
export const HOTBAR_DEFAULT = [PLANKS, STONE_BRICK, GLASS, ROOFING, FENCE, TORCH];

// Flat lookup tables for the hot loops (mesher, physics).
const N = 256;
export const OPAQUE = new Uint8Array(N);
export const SOLID = new Uint8Array(N);
export const SHAPE_OF = new Uint8Array(N);
export const GROUP_OF = new Uint8Array(N);
export const CULL_SAME = new Uint8Array(N);
export const REPLACEABLE = new Uint8Array(N);
export const LIQUID = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const b = BLOCKS[i];
  if (!b) continue;
  OPAQUE[i] = b.opaque ? 1 : 0;
  SOLID[i] = b.solid ? 1 : 0;
  SHAPE_OF[i] = b.shape;
  GROUP_OF[i] = b.group;
  CULL_SAME[i] = b.cullSame ? 1 : 0;
  REPLACEABLE[i] = b.replaceable ? 1 : 0;
  LIQUID[i] = b.liquid ? 1 : 0;
}

export function blockById(id) {
  return BLOCKS[id] || BLOCKS[0];
}
export function blocksInPack(pack) {
  return BLOCKS.filter((b) => b && b.inventory && b.pack === pack);
}
