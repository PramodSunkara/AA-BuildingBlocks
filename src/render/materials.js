import * as THREE from 'three';

// One material per render group. Index matches GROUP in data/blocks.js.
export function createMaterials(atlasTexture) {
  const opaque = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true });
  const cutout = new THREE.MeshLambertMaterial({
    map: atlasTexture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  const transparent = new THREE.MeshLambertMaterial({
    map: atlasTexture, vertexColors: true, transparent: true, alphaTest: 0.02, depthWrite: true, side: THREE.DoubleSide,
  });
  opaque.name = 'blocks-opaque';
  cutout.name = 'blocks-cutout';
  transparent.name = 'blocks-transparent';
  return [opaque, cutout, transparent];
}
