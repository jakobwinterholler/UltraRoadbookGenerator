#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TERRAIN_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_ZOOM = 14;
const TILE_PAD = 0.018;

function lonLatToTile(lon, lat, zoom) {
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  );
  return { x, y, z: zoom };
}

function segmentBounds(track) {
  const lats = track.map((point) => point.lat);
  const lons = track.map((point) => point.lon);
  return {
    south: Math.min(...lats) - TILE_PAD,
    north: Math.max(...lats) + TILE_PAD,
    west: Math.min(...lons) - TILE_PAD,
    east: Math.max(...lons) + TILE_PAD,
  };
}

function listTileJobs(track) {
  const bounds = segmentBounds(track);
  const minTile = lonLatToTile(bounds.west, bounds.north, TERRAIN_ZOOM);
  const maxTile = lonLatToTile(bounds.east, bounds.south, TERRAIN_ZOOM);
  const jobs = [];
  for (let tileY = minTile.y; tileY <= maxTile.y; tileY += 1) {
    for (let tileX = minTile.x; tileX <= maxTile.x; tileX += 1) {
      jobs.push({ z: TERRAIN_ZOOM, x: tileX, y: tileY });
    }
  }
  return jobs;
}

export function hashSegment(segment) {
  return createHash("sha256").update(JSON.stringify(segment)).digest("hex").slice(0, 16);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadToFile(url, destination) {
  await mkdir(dirname(destination), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  if (!response.body) {
    throw new Error(`Empty response body for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

export async function ensureTileCache(cacheDir, segmentPath) {
  const segment = JSON.parse(await readFile(segmentPath, "utf8"));
  const segmentHash = hashSegment(segment);
  const manifestPath = join(cacheDir, "manifest.json");
  let manifest = null;

  if (await fileExists(manifestPath)) {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.segment_hash === segmentHash && manifest.terrain_zoom === TERRAIN_ZOOM) {
      const jobs = listTileJobs(segment.track);
      let hits = 0;
      for (const job of jobs) {
        const satPath = join(cacheDir, "sat", String(job.z), String(job.x), `${job.y}.jpg`);
        const demPath = join(cacheDir, "dem", String(job.z), String(job.x), `${job.y}.png`);
        if ((await fileExists(satPath)) && (await fileExists(demPath))) {
          hits += 1;
        }
      }
      if (hits === jobs.length) {
        return { segment, segmentHash, manifest, cacheHit: true, tileCount: jobs.length };
      }
    }
  }

  await mkdir(cacheDir, { recursive: true });
  const jobs = listTileJobs(segment.track);
  let downloaded = 0;

  for (const job of jobs) {
    const satPath = join(cacheDir, "sat", String(job.z), String(job.x), `${job.y}.jpg`);
    const demPath = join(cacheDir, "dem", String(job.z), String(job.x), `${job.y}.png`);
    const satUrl = SATELLITE_URL.replace("{z}", String(job.z))
      .replace("{x}", String(job.x))
      .replace("{y}", String(job.y));
    const demUrl = TERRAIN_URL.replace("{z}", String(job.z))
      .replace("{x}", String(job.x))
      .replace("{y}", String(job.y));

    if (!(await fileExists(satPath))) {
      await downloadToFile(satUrl, satPath);
    }
    if (!(await fileExists(demPath))) {
      await downloadToFile(demUrl, demPath);
    }
    downloaded += 1;
    if (downloaded % 8 === 0 || downloaded === jobs.length) {
      console.log(`PROGRESS:${JSON.stringify({ type: "cache_tiles", current: downloaded, total: jobs.length })}`);
    }
  }

  manifest = {
    segment_hash: segmentHash,
    terrain_zoom: TERRAIN_ZOOM,
    tile_count: jobs.length,
    bounds: segmentBounds(segment.track),
    updated_at: new Date().toISOString(),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { segment, segmentHash, manifest, cacheHit: false, tileCount: jobs.length };
}
