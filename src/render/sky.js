import * as THREE from 'three';
import { CONFIG } from '../config.js';

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = normalize(wp.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const frag = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  varying vec3 vDir;
  void main() {
    float t = clamp(vDir.y, 0.0, 1.0);
    float k = pow(t, 0.55);
    gl_FragColor = vec4(mix(horizon, zenith, k), 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSky(scene) {
  const day = CONFIG.sky.day;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: new THREE.Color(day.zenith) },
      horizon: { value: new THREE.Color(day.horizon) },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 12), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);

  const rd = CONFIG.world.renderDistanceChunks * CONFIG.world.chunkSize;
  scene.fog = new THREE.Fog(new THREE.Color(day.horizon), rd * CONFIG.render.fogStartFraction, rd);

  function setColors(zenithHex, horizonHex) {
    material.uniforms.zenith.value.set(zenithHex);
    material.uniforms.horizon.value.set(horizonHex);
    scene.fog.color.set(horizonHex);
  }

  function setColorsRGB(zenith, horizon) {
    material.uniforms.zenith.value.copy(zenith);
    material.uniforms.horizon.value.copy(horizon);
    scene.fog.color.copy(horizon);
  }

  function update(cameraPosition) {
    mesh.position.copy(cameraPosition);
  }

  return { mesh, setColors, setColorsRGB, update };
}
