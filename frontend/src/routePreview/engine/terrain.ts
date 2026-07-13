import * as THREE from "three";
import { buildMapTexture } from "./mapTexture";
import {
  TILE_SIZE,
  boundsFromTrack,
  fetchTileImage,
  meshDimensionsMeters,
  tileGridForBounds,
} from "./tileUtils";
import { applyStylizedTerrainColors } from "./terrainStyle";
import type { RoutePreviewVisualStyle } from "./visualStyles";
import { exaggerationForStyle } from "./visualStyles";

const TERRAIN_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_ZOOM_DEFAULT = 14;

export interface TerrainBuildResult {
  mesh: THREE.Mesh;
  heightSampler: (x: number, z: number) => number;
  originLat: number;
  originLon: number;
}

function decodeTerrarium(r: number, g: number, b: number) {
  return r * 256 + g + b / 256 - 32768;
}

function sampleDemBilinear(
  demData: Uint8ClampedArray,
  width: number,
  height: number,
  u: number,
  v: number,
) {
  const fu = Math.min(width - 1, Math.max(0, u)) * (width - 1);
  const fv = Math.min(height - 1, Math.max(0, v)) * (height - 1);
  const x0 = Math.floor(fu);
  const y0 = Math.floor(fv);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fu - x0;
  const ty = fv - y0;

  function px(x: number, y: number) {
    const index = (y * width + x) * 4;
    return decodeTerrarium(demData[index], demData[index + 1], demData[index + 2]);
  }

  const h00 = px(x0, y0);
  const h10 = px(x1, y0);
  const h01 = px(x0, y1);
  const h11 = px(x1, y1);
  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return hx0 + (hx1 - hx0) * ty;
}

export interface BuildTerrainOptions {
  track: Array<{ lat: number; lon: number }>;
  terrainSegments: number;
  terrainZoom?: number;
  cacheBaseUrl?: string;
  visualStyle?: RoutePreviewVisualStyle;
  onProgress?: (loaded: number, total: number) => void;
}

export async function buildTerrain(options: BuildTerrainOptions): Promise<TerrainBuildResult> {
  const { track, terrainSegments, cacheBaseUrl, onProgress } = options;
  const visualStyle = options.visualStyle ?? "map-2d5";
  const terrainZoom = options.terrainZoom ?? TERRAIN_ZOOM_DEFAULT;
  const exaggeration = exaggerationForStyle(visualStyle);

  const { originLat, originLon, ...bounds } = boundsFromTrack(track, terrainZoom);
  const grid = tileGridForBounds(bounds, terrainZoom);
  const { widthM, depthM, tileWest, tileEast, tileNorth, tileSouth } = meshDimensionsMeters(
    grid,
    originLat,
    originLon,
  );

  let demData: Uint8ClampedArray | null = null;
  let demWidth = 0;
  let demHeight = 0;

  if (exaggeration > 0) {
    const demCanvas = document.createElement("canvas");
    demCanvas.width = grid.tilesX * TILE_SIZE;
    demCanvas.height = grid.tilesY * TILE_SIZE;
    const demCtx = demCanvas.getContext("2d")!;
    demCtx.imageSmoothingEnabled = false;

    const demJobs = [];
    for (let tileY = grid.minTile.y; tileY <= grid.maxTile.y; tileY += 1) {
      for (let tileX = grid.minTile.x; tileX <= grid.maxTile.x; tileX += 1) {
        const remoteDem = TERRAIN_URL.replace("{z}", String(terrainZoom))
          .replace("{x}", String(tileX))
          .replace("{y}", String(tileY));
        demJobs.push({
          drawX: (tileX - grid.minTile.x) * TILE_SIZE,
          drawY: (tileY - grid.minTile.y) * TILE_SIZE,
          demCacheUrl: cacheBaseUrl
            ? `${cacheBaseUrl}/dem/${terrainZoom}/${tileX}/${tileY}.png`
            : undefined,
          remoteDem,
        });
      }
    }

    let loaded = 0;
    const batchSize = 8;
    for (let index = 0; index < demJobs.length; index += batchSize) {
      const batch = demJobs.slice(index, index + batchSize);
      await Promise.all(
        batch.map(async (job) => {
          const demImage = await fetchTileImage(job.demCacheUrl, job.remoteDem);
          demCtx.drawImage(demImage, job.drawX, job.drawY);
        }),
      );
      loaded += batch.length;
      onProgress?.(loaded, demJobs.length);
    }

    demData = demCtx.getImageData(0, 0, demCanvas.width, demCanvas.height).data;
    demWidth = demCanvas.width;
    demHeight = demCanvas.height;
  }

  function sampleHeightMeters(x: number, z: number) {
    if (!demData || exaggeration === 0) {
      return 0;
    }
    const lon = originLon + x / (Math.cos((originLat * Math.PI) / 180) * 111_320);
    const lat = originLat - z / 110_540;
    const u = (lon - tileWest) / (tileEast - tileWest);
    const v = (tileNorth - lat) / (tileNorth - tileSouth);
    const elevation = sampleDemBilinear(demData, demWidth, demHeight, u, v);
    return elevation * exaggeration;
  }

  const geometry = new THREE.PlaneGeometry(widthM, depthM, terrainSegments, terrainSegments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    const x = positions.getX(vertex);
    const z = positions.getZ(vertex);
    positions.setY(vertex, sampleHeightMeters(x, z));
    uvs.setXY(vertex, x / widthM + 0.5, 1 - (z / depthM + 0.5));
  }

  let mesh: THREE.Mesh;

  if (visualStyle === "terrain-3d") {
    applyStylizedTerrainColors(geometry, sampleHeightMeters, exaggeration);
    mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.94,
        metalness: 0,
        flatShading: false,
      }),
    );
  } else {
    const mapTexture = await buildMapTexture(bounds, terrainZoom, {
      includeHillshade: visualStyle === "map-2d5",
      hillshadeStrength: 0.36,
      onProgress,
    });

    mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: mapTexture.texture,
        toneMapped: false,
      }),
    );
  }

  mesh.receiveShadow = false;

  return {
    mesh,
    heightSampler: sampleHeightMeters,
    originLat,
    originLon,
  };
}

export function buildRouteMeshes(
  track: Array<{ lat: number; lon: number; km: number }>,
  originLon: number,
  originLat: number,
  heightSampler: (x: number, z: number) => number,
  routeTubeSegments: number,
  visualStyle: RoutePreviewVisualStyle = "map-2d5",
) {
  const ROUTE_CORE = 0x7c3aed;
  const ROUTE_HALO = 0xc4b5fd;
  const routeOffset = visualStyle === "terrain-3d" ? 2.5 : 1.2;
  const haloRadius = visualStyle === "map-2d" ? 4.5 : 6;
  const coreRadius = visualStyle === "map-2d" ? 2.2 : 2.8;

  if (track.length < 2) {
    return [];
  }

  const seedPoints = track.map((point) => {
    const cosLat = Math.cos((originLat * Math.PI) / 180);
    const x = (point.lon - originLon) * cosLat * 111_320;
    const z = -(point.lat - originLat) * 110_540;
    return new THREE.Vector3(x, heightSampler(x, z) + routeOffset, z);
  });

  const curve = new THREE.CatmullRomCurve3(seedPoints, false, "catmullrom", 0.08);
  const tubularSegments = Math.min(
    routeTubeSegments,
    Math.max(48, Math.floor(curve.getLength() / 55)),
  );
  const haloGeometry = new THREE.TubeGeometry(curve, tubularSegments, haloRadius, 6, false);
  const coreGeometry = new THREE.TubeGeometry(curve, tubularSegments, coreRadius, 6, false);

  return [
    new THREE.Mesh(
      haloGeometry,
      new THREE.MeshBasicMaterial({
        color: ROUTE_HALO,
        transparent: true,
        opacity: visualStyle === "map-2d" ? 0.45 : 0.35,
        depthWrite: false,
      }),
    ),
    new THREE.Mesh(
      coreGeometry,
      new THREE.MeshBasicMaterial({
        color: ROUTE_CORE,
        transparent: true,
        opacity: 0.96,
      }),
    ),
  ];
}
