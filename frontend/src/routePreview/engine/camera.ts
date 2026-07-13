import * as THREE from "three";
import { interpolateTrack, routeProgressAtTime } from "../core/progress";
import { routeKmSpan, routeSamples } from "../core/routeTrack";
import type { RoutePreviewRuntime } from "../core/types";

const ROUTE_OFFSET_M = 2.5;

/** Companion camera: stable, map-like, optimized for orientation — not cinema. */
const COMPANION_ALTITUDE_M = 720;
const COMPANION_HORIZONTAL_M = 340;
const COMPANION_LOOK_AHEAD_KM = 0.55;
const COMPANION_LOOK_HEIGHT_M = 12;
const BEARING_SAMPLE_KM = 1.2;

export interface CameraSample {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export function lonLatToMeters(lon: number, lat: number, originLon: number, originLat: number) {
  const cosLat = Math.cos((originLat * Math.PI) / 180);
  const x = (lon - originLon) * cosLat * 111_320;
  const z = -(lat - originLat) * 110_540;
  return { x, z };
}

function smoothBearingAtKm(runtime: RoutePreviewRuntime, km: number): THREE.Vector3 {
  const { startKm, endKm } = routeKmSpan(runtime);
  const prev = interpolateTrack(runtime, Math.max(startKm, km - BEARING_SAMPLE_KM));
  const next = interpolateTrack(runtime, Math.min(endKm, km + BEARING_SAMPLE_KM));
  const samples = routeSamples(runtime);
  const originLon = samples[0]?.lon ?? prev.lon;
  const originLat = samples[0]?.lat ?? prev.lat;
  const prevM = lonLatToMeters(prev.lon, prev.lat, originLon, originLat);
  const nextM = lonLatToMeters(next.lon, next.lat, originLon, originLat);
  const tangent = new THREE.Vector3(nextM.x - prevM.x, 0, nextM.z - prevM.z);
  if (tangent.lengthSq() < 1e-4) {
    tangent.set(0, 0, 1);
  } else {
    tangent.normalize();
  }
  return tangent;
}

function valleyBiasMultiplier(runtime: RoutePreviewRuntime, km: number): number {
  const windowKm = 2;
  const center = interpolateTrack(runtime, km);
  const before = interpolateTrack(runtime, Math.max(0, km - windowKm));
  const after = interpolateTrack(runtime, Math.min(runtime.distanceKm, km + windowKm));
  const localRelief = Math.max(center.ele_m, before.ele_m, after.ele_m) - Math.min(center.ele_m, before.ele_m, after.ele_m);
  if (localRelief > 180) {
    return 1.12;
  }
  if (localRelief < 40) {
    return 0.92;
  }
  return 1;
}

export class RoutePreviewCameraPath {
  constructor(
    private readonly runtime: RoutePreviewRuntime,
    private readonly heightSampler: (x: number, z: number) => number,
    private readonly originLon: number,
    private readonly originLat: number,
  ) {}

  sample(timeS: number): CameraSample {
    const progress = routeProgressAtTime(this.runtime, timeS);
    const point = interpolateTrack(this.runtime, progress.km);
    const { x, z } = lonLatToMeters(point.lon, point.lat, this.originLon, this.originLat);
    const routePoint = new THREE.Vector3(x, this.heightSampler(x, z) + ROUTE_OFFSET_M, z);

    const { endKm: routeEndKm } = routeKmSpan(this.runtime);
    const tangent = smoothBearingAtKm(this.runtime, progress.km);
    const scale = valleyBiasMultiplier(this.runtime, progress.km);

    const lookKm = Math.min(routeEndKm, progress.km + COMPANION_LOOK_AHEAD_KM);
    const lookTrack = interpolateTrack(this.runtime, lookKm);
    const lookM = lonLatToMeters(lookTrack.lon, lookTrack.lat, this.originLon, this.originLat);
    const lookGroundY = this.heightSampler(lookM.x, lookM.z);
    const lookAt = new THREE.Vector3(lookM.x, lookGroundY + COMPANION_LOOK_HEIGHT_M, lookM.z);

    const behind = tangent.clone().multiplyScalar(-COMPANION_HORIZONTAL_M * scale);
    const cameraAnchor = routePoint.clone().add(behind);
    const groundY = this.heightSampler(cameraAnchor.x, cameraAnchor.z);
    const position = new THREE.Vector3(
      cameraAnchor.x,
      groundY + COMPANION_ALTITUDE_M * scale,
      cameraAnchor.z,
    );

    return { position, lookAt };
  }
}

export class SmoothedCamera {
  private readonly position = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private initialized = false;
  private lastTimeS = 0;

  reset(sample: CameraSample) {
    this.position.copy(sample.position);
    this.lookAt.copy(sample.lookAt);
    this.initialized = true;
  }

  update(sample: CameraSample, timeS: number): CameraSample {
    const deltaS = Math.max(0.001, Math.min(0.12, timeS - this.lastTimeS || 1 / 60));
    this.lastTimeS = timeS;

    if (!this.initialized) {
      this.reset(sample);
      return { position: this.position.clone(), lookAt: this.lookAt.clone() };
    }

    const positionSmooth = 1 - Math.exp(-1.1 * deltaS);
    const bearingSmooth = 1 - Math.exp(-0.85 * deltaS);
    this.position.lerp(sample.position, positionSmooth);
    this.lookAt.lerp(sample.lookAt, bearingSmooth);
    return { position: this.position.clone(), lookAt: this.lookAt.clone() };
  }
}
