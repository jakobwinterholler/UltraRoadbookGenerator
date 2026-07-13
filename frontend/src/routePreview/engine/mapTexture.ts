import * as THREE from "three";
import {
  TILE_SIZE,
  fetchTileImage,
  tileGridForBounds,
  type TileBounds,
} from "./tileUtils";

/** Carto Voyager without labels — forests, water, towns, thin roads. */
const CARTO_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const CARTO_SUBDOMAINS = ["a", "b", "c", "d"];

/** Esri world hillshade for subtle relief in 2.5D mode. */
const HILLSHADE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

function cartoUrl(z: number, x: number, y: number) {
  const sub = CARTO_SUBDOMAINS[(x + y) % CARTO_SUBDOMAINS.length];
  return CARTO_URL.replace("{s}", sub)
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{r}", "");
}

function hillshadeUrl(z: number, x: number, y: number) {
  return HILLSHADE_URL.replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

export interface MapTextureResult {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
}

export async function buildMapTexture(
  bounds: TileBounds,
  terrainZoom: number,
  options: {
    includeHillshade: boolean;
    hillshadeStrength?: number;
    onProgress?: (loaded: number, total: number) => void;
  },
): Promise<MapTextureResult> {
  const grid = tileGridForBounds(bounds, terrainZoom);
  const canvas = document.createElement("canvas");
  canvas.width = grid.tilesX * TILE_SIZE;
  canvas.height = grid.tilesY * TILE_SIZE;

  const baseCtx = canvas.getContext("2d")!;
  baseCtx.imageSmoothingEnabled = true;
  baseCtx.imageSmoothingQuality = "high";

  const tileJobs = [];
  for (let tileY = grid.minTile.y; tileY <= grid.maxTile.y; tileY += 1) {
    for (let tileX = grid.minTile.x; tileX <= grid.maxTile.x; tileX += 1) {
      tileJobs.push({
        drawX: (tileX - grid.minTile.x) * TILE_SIZE,
        drawY: (tileY - grid.minTile.y) * TILE_SIZE,
        cartoUrl: cartoUrl(terrainZoom, tileX, tileY),
        hillshadeUrl: hillshadeUrl(terrainZoom, tileX, tileY),
      });
    }
  }

  let loaded = 0;
  const batchSize = 6;
  for (let index = 0; index < tileJobs.length; index += batchSize) {
    const batch = tileJobs.slice(index, index + batchSize);
    await Promise.all(
      batch.map(async (job) => {
        const cartoImage = await fetchTileImage(undefined, job.cartoUrl);
        baseCtx.drawImage(cartoImage, job.drawX, job.drawY);

        if (options.includeHillshade) {
          try {
            const hillImage = await fetchTileImage(undefined, job.hillshadeUrl);
            baseCtx.save();
            baseCtx.globalAlpha = options.hillshadeStrength ?? 0.38;
            baseCtx.globalCompositeOperation = "multiply";
            baseCtx.drawImage(hillImage, job.drawX, job.drawY);
            baseCtx.restore();
          } catch {
            // Hillshade is optional — map still readable without it.
          }
        }
      }),
    );
    loaded += batch.length;
    options.onProgress?.(loaded, tileJobs.length);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return { texture, canvas };
}
