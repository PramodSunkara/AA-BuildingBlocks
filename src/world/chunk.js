export const CH = 16; // chunk width/depth
export const CY = 48; // world height

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CH * CY * CH);
    this.edits = new Map(); // voxel index -> block id (diff against generated terrain)
    this.dirty = true;
    this.meshes = null;
  }
  static index(x, y, z) {
    return (y * CH + z) * CH + x;
  }
  get(x, y, z) {
    return this.data[(y * CH + z) * CH + x];
  }
  set(x, y, z, id) {
    this.data[(y * CH + z) * CH + x] = id;
  }
}
