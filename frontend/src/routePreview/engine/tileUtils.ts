import { lonLatToMeters } from "./camera";

export const TILE_SIZE = 256;

export interface TileBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface TileGrid {
  minTile: { x: number; y: number; z: number };
  maxTile: { x: number; y: number; z: number };
  tilesX: number;
  tilesY: number;
  terrainZoom: number;
}

export function lonLatToTile(lon: number, lat: number, zoom: number) {
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  );
  return { x, y, z: zoom };
}

export function tile2lonLat(tileX: number, tileY: number, zoom: number) {
  const n = 2 ** zoom;
  const lon = (tileX / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lon, lat };
}

export function tileGridForBounds(bounds: TileBounds, terrainZoom: number): TileGrid {
  const minTile = lonLatToTile(bounds.west, bounds.north, terrainZoom);
  const maxTile = lonLatToTile(bounds.east, bounds.south, terrainZoom);
  return {
    minTile,
    maxTile,
    tilesX: maxTile.x - minTile.x + 1,
    tilesY: maxTile.y - minTile.y + 1,
    terrainZoom,
  };
}

export function boundsFromTrack(
  track: Array<{ lat: number; lon: number }>,
  terrainZoom: number,
  pad = 0.018,
): TileBounds & { originLat: number; originLon: number } {
  const lats = track.map((point) => point.lat);
  const lons = track.map((point) => point.lon);
  const padded = terrainZoom <= 11 ? 0.06 : pad;
  const bounds = {
    south: Math.min(...lats) - padded,
    north: Math.max(...lats) + padded,
    west: Math.min(...lons) - padded,
    east: Math.max(...lons) + padded,
  };
  return {
    ...bounds,
    originLat: (bounds.south + bounds.north) / 2,
    originLon: (bounds.west + bounds.east) / 2,
  };
}

export function meshDimensionsMeters(
  grid: TileGrid,
  originLat: number,
  originLon: number,
): { widthM: number; depthM: number; tileWest: number; tileEast: number; tileNorth: number; tileSouth: number } {
  const tileNorth = tile2lonLat(grid.minTile.x, grid.minTile.y, grid.terrainZoom).lat;
  const tileSouth = tile2lonLat(grid.minTile.x, grid.minTile.y + grid.tilesY, grid.terrainZoom).lat;
  const tileWest = tile2lonLat(grid.minTile.x, grid.minTile.y, grid.terrainZoom).lon;
  const tileEast = tile2lonLat(grid.minTile.x + grid.tilesX, grid.minTile.y, grid.terrainZoom).lon;
  const widthM = Math.abs(
    lonLatToMeters(tileEast, originLat, originLon, originLat).x -
      lonLatToMeters(tileWest, originLat, originLon, originLat).x,
  );
  const depthM = Math.abs(
    lonLatToMeters(originLon, tileSouth, originLon, originLat).z -
      lonLatToMeters(originLon, tileNorth, originLon, originLat).z,
  );
  return { widthM, depthM, tileWest, tileEast, tileNorth, tileSouth };
}

export async function fetchImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const blob = await response.blob();
  return createImageBitmap(blob);
}

export async function fetchTileImage(cacheUrl: string | undefined, remoteUrl: string) {
  if (cacheUrl) {
    try {
      return await fetchImage(cacheUrl);
    } catch {
      // Fall back to live tiles when cache is missing or stale.
    }
  }
  return fetchImage(remoteUrl);
}
