#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTileCache } from "./tile-cache.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

const runtimeArg = readArg("--runtime");
const cacheArg = readArg("--cache-dir");
if (!runtimeArg || !cacheArg) {
  console.error("Usage: node prepare-cache.mjs --runtime <runtime.json> --cache-dir <dir>");
  process.exit(1);
}

const runtimePath = resolve(runtimeArg);
const cacheDir = resolve(cacheArg);
const segmentPath = join(dirname(runtimePath), "segment.json");

const result = await ensureTileCache(cacheDir, segmentPath);
console.log(
  `PROGRESS:${JSON.stringify({
    type: "cache",
    status: result.cacheHit ? "hit" : "miss",
    tile_count: result.tileCount,
  })}`,
);
