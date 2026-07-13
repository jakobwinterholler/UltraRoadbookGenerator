import * as THREE from "three";

/** Premium hiking-map palette — readability over realism. */
function colorFromElevation(elevationM: number, slope: number, target: THREE.Color): THREE.Color {
  // Water — low valleys
  if (elevationM < 180) {
    return target.setRGB(0.62, 0.78, 0.9);
  }
  // Lowland / farmland
  if (elevationM < 350) {
    return target.lerpColors(
      new THREE.Color(0.62, 0.78, 0.9),
      new THREE.Color(0.86, 0.9, 0.78),
      (elevationM - 180) / 170,
    );
  }
  // Forest — mid elevation, gentle slopes
  if (elevationM < 900) {
    const forestGreen = new THREE.Color(0.42, 0.62, 0.38);
    const deepForest = new THREE.Color(0.32, 0.52, 0.3);
    const t = (elevationM - 350) / 550;
    target.lerpColors(forestGreen, deepForest, t);
    if (slope > 0.35) {
      target.lerp(new THREE.Color(0.55, 0.52, 0.46), slope * 0.4);
    }
    return target;
  }
  // Alpine meadow / scrub
  if (elevationM < 1400) {
    return target.lerpColors(
      new THREE.Color(0.38, 0.55, 0.34),
      new THREE.Color(0.62, 0.58, 0.48),
      (elevationM - 900) / 500,
    );
  }
  // Rock — high elevation or steep
  if (elevationM < 2000) {
    const rock = new THREE.Color(0.68, 0.66, 0.62);
    target.lerpColors(new THREE.Color(0.58, 0.56, 0.5), rock, (elevationM - 1400) / 600);
    if (slope > 0.25) {
      target.lerp(new THREE.Color(0.72, 0.7, 0.66), slope * 0.5);
    }
    return target;
  }
  // Summit snow/rock
  return target.setRGB(0.88, 0.87, 0.84);
}

const HILLSHADE_LIGHT = new THREE.Vector3(-0.48, 0.82, 0.32).normalize();

function estimateSlope(
  sampleElevationM: (x: number, z: number) => number,
  x: number,
  z: number,
  exaggeration: number,
): number {
  const step = 45;
  const center = sampleElevationM(x, z) / exaggeration;
  const east = sampleElevationM(x + step, z) / exaggeration;
  const north = sampleElevationM(x, z - step) / exaggeration;
  const riseX = Math.abs(east - center);
  const riseZ = Math.abs(north - center);
  return Math.min(1, Math.sqrt(riseX * riseX + riseZ * riseZ) / 80);
}

export function applyStylizedTerrainColors(
  geometry: THREE.BufferGeometry,
  sampleElevationM: (x: number, z: number) => number,
  exaggeration: number,
): void {
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;

  const baseColor = new THREE.Color();
  const shaded = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const elevationM = sampleElevationM(x, z) / exaggeration;
    const slope = estimateSlope(sampleElevationM, x, z, exaggeration);

    const nx = normals.getX(index);
    const ny = normals.getY(index);
    const nz = normals.getZ(index);
    const shade = THREE.MathUtils.clamp(
      nx * HILLSHADE_LIGHT.x + ny * HILLSHADE_LIGHT.y + nz * HILLSHADE_LIGHT.z,
      0,
      1,
    );
    const shadeFactor = shade * 0.42 + 0.68;
    const clampedShade = THREE.MathUtils.clamp(shadeFactor, 0.55, 1.02);

    colorFromElevation(elevationM, slope, baseColor);
    shaded.copy(baseColor).multiplyScalar(clampedShade);
    colors[index * 3] = shaded.r;
    colors[index * 3 + 1] = shaded.g;
    colors[index * 3 + 2] = shaded.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
