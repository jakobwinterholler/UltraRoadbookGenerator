#!/usr/bin/env node
/**
 * Measured performance profile for route preview rendering.
 * Usage: node profile.mjs [--frames 48]
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { accessSync, constants } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import { ensureTileCache, hashSegment } from "./tile-cache.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "../..");
const RACE_ID = "d836e1d9-1fa9-49ea-8476-694c6c00d090";

const frameArgIndex = process.argv.indexOf("--frames");
const profileFrameCount = frameArgIndex === -1 ? 48 : Number(process.argv[frameArgIndex + 1]);
const fullFps = 24;
const fullDurationS = 108;
const fullFrameCount = fullFps * fullDurationS;
const renderWidth = 2560;
const renderHeight = 1440;
const profileDir = join(__dirname, "output", "profile");
const profileCacheDir = join(profileDir, "cache");
const profilePipeMp4 = join(profileDir, "profile-sample.mp4");
const segmentPath = join(__dirname, "segment/capitals-hardest-climb.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".bin": "application/octet-stream",
};

function ms(start) {
  return performance.now() - start;
}

function avg(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function readManifest(cacheRoot) {
  try {
    return JSON.parse(await readFile(join(cacheRoot, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

function startStaticServer(root, cacheRoot) {
  return new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const pathname = decodeURIComponent(url.pathname);

        if (cacheRoot && request.method === "POST" && pathname.startsWith("/cache/derived/")) {
          const fileName = pathname.slice("/cache/derived/".length);
          const hash = url.searchParams.get("hash");
          const manifest = await readManifest(cacheRoot);
          if (!hash || !manifest || manifest.segment_hash !== hash) {
            response.writeHead(409);
            response.end("Cache hash mismatch");
            return;
          }
          const derivedDir = join(cacheRoot, "derived", hash);
          await mkdir(derivedDir, { recursive: true });
          const chunks = [];
          for await (const chunk of request) {
            chunks.push(chunk);
          }
          await writeFile(join(derivedDir, fileName), Buffer.concat(chunks));
          response.writeHead(204);
          response.end();
          return;
        }

        let filePath;
        if (cacheRoot && pathname.startsWith("/cache/")) {
          filePath = join(cacheRoot, pathname.slice("/cache/".length));
          if (pathname.startsWith("/cache/derived/")) {
            const fileName = pathname.slice("/cache/derived/".length);
            const hash = url.searchParams.get("hash");
            const manifest = await readManifest(cacheRoot);
            if (!hash || !manifest || manifest.segment_hash !== hash) {
              response.writeHead(404);
              response.end("Not found");
              return;
            }
            filePath = join(cacheRoot, "derived", hash, fileName);
          }
        } else {
          filePath = join(root, pathname === "/" ? "/index.html" : pathname);
        }

        const data = await readFile(filePath);
        const ext = extname(filePath);
        response.writeHead(200, { "Content-Type": mimeTypes[ext] ?? "application/octet-stream" });
        response.end(data);
      } catch {
        response.writeHead(404);
        response.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function resolveFfmpeg() {
  for (const candidate of ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }
  return "ffmpeg";
}

async function timeStoryGeneration() {
  const started = performance.now();
  await new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        join(PROJECT_ROOT, "scripts/prepare_route_preview_poc.py"),
        RACE_ID,
        "--output",
        join(profileDir, "segment.json"),
      ],
      { cwd: PROJECT_ROOT, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Story generation exited with code ${code}`));
      }
    });
  });
  return ms(started);
}

async function runFfmpegPipeTimed(frameCount, fps) {
  const started = performance.now();
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      resolveFfmpeg(),
      [
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-framerate",
        String(fps),
        "-i",
        "pipe:0",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "16",
        "-preset",
        "medium",
        profilePipeMp4,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    (async () => {
      try {
        for (let frame = 0; frame < frameCount; frame += 1) {
          const jpeg = await readFile(
            join(profileCacheDir, "frames", `${String(frame).padStart(6, "0")}.jpg`),
          );
          ffmpeg.stdin.write(jpeg);
        }
        ffmpeg.stdin.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
  return ms(started);
}

async function waitForBoot(page) {
  while (true) {
    const state = await page.evaluate(() => ({
      ready: window.__pocReady === true,
      error: window.__pocBootError ?? null,
    }));
    if (state.ready) {
      return page.evaluate(() => window.__pocBootTimings);
    }
    if (state.error) {
      throw new Error(state.error);
    }
    await page.waitForTimeout(250);
  }
}

async function main() {
  await rm(profileDir, { recursive: true, force: true });
  await mkdir(join(profileCacheDir, "frames"), { recursive: true });

  const measurements = {
    config: {
      profile_frames: profileFrameCount,
      full_frames: fullFrameCount,
      resolution: `${renderWidth}x${renderHeight}`,
      full_fps: fullFps,
      full_duration_s: fullDurationS,
      capture_mode: "canvas-jpeg",
    },
    stages: {},
  };

  console.log("=== Route Preview Performance Profile ===\n");

  console.log("1/5 Story generation (Python)…");
  measurements.stages.story_generation_ms = await timeStoryGeneration();

  console.log("2/5 Tile cache warm-up…");
  const cacheStarted = performance.now();
  const cacheResult = await ensureTileCache(profileCacheDir, segmentPath);
  measurements.stages.tile_cache_ms = ms(cacheStarted);
  measurements.stages.tile_cache_hit = cacheResult.cacheHit;

  console.log("3/5 Browser boot…");
  const browserLaunchStarted = performance.now();
  const { server, port } = await startStaticServer(__dirname, profileCacheDir);
  const browser = await chromium.launch({ headless: true });
  measurements.stages.browser_launch_ms = ms(browserLaunchStarted);

  const page = await browser.newPage({
    viewport: { width: renderWidth, height: renderHeight },
    deviceScaleFactor: 1,
  });

  const gotoStarted = performance.now();
  await page.goto(
    `http://127.0.0.1:${port}/index.html?profile=1&capture=1&fps=${fullFps}` +
      `&duration=${fullDurationS}&segment=./segment/capitals-hardest-climb.json` +
      `&cache=1&cache-base=http://127.0.0.1:${port}/cache&segment-hash=${cacheResult.segmentHash}`,
    { waitUntil: "domcontentloaded", timeout: 120_000 },
  );
  measurements.stages.page_goto_ms = ms(gotoStarted);

  const bootStarted = performance.now();
  const bootTimings = await waitForBoot(page);
  measurements.stages.browser_boot_total_ms = ms(bootStarted);
  measurements.boot_breakdown = bootTimings;

  console.log(`4/5 Capturing ${profileFrameCount} profile frames…`);
  const frameStats = {
    canvas_capture_ms: [],
    jpeg_write_ms: [],
    frame_total_ms: [],
    webgl_render_ms: [],
    camera_ms: [],
    overlay_ms: [],
  };

  for (let frame = 0; frame < profileFrameCount; frame += 1) {
    const frameStarted = performance.now();

    const captureStarted = performance.now();
    const jpegBase64 = await page.evaluate(
      async (index) => window.__captureFrameJpeg(index),
      frame,
    );
    frameStats.canvas_capture_ms.push(ms(captureStarted));

    const browserFrameTimings = await page.evaluate(() => window.__lastFrameTimings ?? null);
    if (browserFrameTimings) {
      frameStats.webgl_render_ms.push(browserFrameTimings.webgl_render_ms ?? 0);
      frameStats.camera_ms.push(browserFrameTimings.camera_ms ?? 0);
      frameStats.overlay_ms.push(browserFrameTimings.overlay_ms ?? 0);
    }

    const writeStarted = performance.now();
    await writeFile(
      join(profileCacheDir, "frames", `${String(frame).padStart(6, "0")}.jpg`),
      Buffer.from(jpegBase64, "base64"),
    );
    frameStats.jpeg_write_ms.push(ms(writeStarted));
    frameStats.frame_total_ms.push(ms(frameStarted));

    if (frame % 12 === 0 || frame === profileFrameCount - 1) {
      console.log(`  frame ${frame + 1}/${profileFrameCount}`);
    }
  }

  await browser.close();
  server.close();

  measurements.frame_sample = {
    count: profileFrameCount,
    avg_ms: Object.fromEntries(
      Object.entries(frameStats).map(([key, values]) => [key, avg(values)]),
    ),
    p95_ms: Object.fromEntries(
      Object.entries(frameStats).map(([key, values]) => [key, percentile(values, 95)]),
    ),
  };

  console.log("5/5 FFmpeg pipe encode sample…");
  measurements.stages.ffmpeg_pipe_sample_ms = await runFfmpegPipeTimed(profileFrameCount, fullFps);

  const boot = bootTimings.phases ?? {};
  const tileDownload = boot.tile_download ?? {};
  const demMesh = boot.dem_mesh ?? {};
  const routeCamera = boot.route_and_camera ?? {};

  const avgFrameTotal = avg(frameStats.frame_total_ms);
  const extrapolatedFrameLoopMs = avgFrameTotal * fullFrameCount;
  const extrapolatedFfmpegMs =
    (measurements.stages.ffmpeg_pipe_sample_ms / profileFrameCount) * fullFrameCount;

  const stages = [
    {
      name: "Story generation",
      measured_ms: measurements.stages.story_generation_ms,
      bound: "CPU",
    },
    {
      name: "Browser launch + page load",
      measured_ms: measurements.stages.browser_launch_ms + measurements.stages.page_goto_ms,
      bound: "CPU",
    },
    {
      name: "Tile cache warm-up (Node)",
      measured_ms: measurements.stages.tile_cache_ms,
      bound: "I/O (network/disk)",
      note: measurements.stages.tile_cache_hit ? "cache hit" : "cache miss",
    },
    {
      name: "Satellite tile load (browser boot)",
      measured_ms: tileDownload.duration_ms ?? 0,
      bound: "I/O (disk when cached)",
      note: `sat fetch sum ${Math.round(tileDownload.sat_fetch_ms ?? 0)} ms across ${tileDownload.tile_count ?? 0} tiles`,
    },
    {
      name: "DEM mesh processing",
      measured_ms: demMesh.duration_ms ?? 0,
      bound: "CPU",
      note: `${demMesh.vertex_count ?? 0} vertices`,
    },
    {
      name: "Scene setup (segment, profile, WebGL init)",
      measured_ms:
        (boot.segment?.duration_ms ?? 0) +
        (boot.profile?.duration_ms ?? 0) +
        (boot.scene?.duration_ms ?? 0),
      bound: "CPU",
    },
    {
      name: "Route + camera path (boot)",
      measured_ms: routeCamera.duration_ms ?? 0,
      bound: "CPU",
    },
    {
      name: "Canvas frame capture (per frame)",
      measured_ms: avg(frameStats.canvas_capture_ms) * fullFrameCount,
      bound: "CPU/GPU readback",
      sample_avg_ms: avg(frameStats.canvas_capture_ms),
    },
    {
      name: "JPEG resume write (per frame)",
      measured_ms: avg(frameStats.jpeg_write_ms) * fullFrameCount,
      bound: "I/O (disk)",
      sample_avg_ms: avg(frameStats.jpeg_write_ms),
    },
    {
      name: "FFmpeg pipe encoding",
      measured_ms: extrapolatedFfmpegMs,
      bound: "CPU",
      sample_ms: measurements.stages.ffmpeg_pipe_sample_ms,
    },
  ];

  const totalExtrapolatedMs =
    measurements.stages.story_generation_ms +
    measurements.stages.browser_launch_ms +
    measurements.stages.page_goto_ms +
    measurements.stages.browser_boot_total_ms +
    measurements.stages.tile_cache_ms +
    extrapolatedFrameLoopMs +
    extrapolatedFfmpegMs;

  measurements.extrapolated_full_render_ms = totalExtrapolatedMs;
  measurements.stages_report = stages.map((stage) => ({
    ...stage,
    pct: (stage.measured_ms / totalExtrapolatedMs) * 100,
  }));

  await writeFile(join(profileDir, "profile.json"), JSON.stringify(measurements, null, 2));

  console.log("\n=== Measured Sample (boot) ===");
  console.log(`Story generation:        ${(measurements.stages.story_generation_ms / 1000).toFixed(2)}s`);
  console.log(`Tile cache warm-up:      ${(measurements.stages.tile_cache_ms / 1000).toFixed(2)}s (${measurements.stages.tile_cache_hit ? "hit" : "miss"})`);
  console.log(`Browser boot total:      ${(measurements.stages.browser_boot_total_ms / 1000).toFixed(2)}s`);
  console.log(`  Tile load (wall):      ${((tileDownload.duration_ms ?? 0) / 1000).toFixed(2)}s`);
  console.log(`  DEM mesh build:        ${((demMesh.duration_ms ?? 0) / 1000).toFixed(2)}s`);
  console.log(`  Route + camera path:   ${((routeCamera.duration_ms ?? 0) / 1000).toFixed(2)}s`);

  console.log("\n=== Measured Sample (per frame avg, n=%d) ===", profileFrameCount);
  console.log(`Frame total:             ${avg(frameStats.frame_total_ms).toFixed(1)} ms`);
  console.log(`  Canvas capture:        ${avg(frameStats.canvas_capture_ms).toFixed(1)} ms`);
  console.log(`  JPEG resume write:     ${avg(frameStats.jpeg_write_ms).toFixed(1)} ms`);

  console.log("\n=== Extrapolated Full Render (%d frames @ %dx%d) ===", fullFrameCount, renderWidth, renderHeight);
  console.log(`Total estimated:         ${(totalExtrapolatedMs / 1000 / 60).toFixed(1)} min`);
  for (const stage of measurements.stages_report.sort((a, b) => b.measured_ms - a.measured_ms)) {
    console.log(
      `${stage.pct.toFixed(1).padStart(5)}%  ${(stage.measured_ms / 1000).toFixed(1).padStart(7)}s  ${stage.name}${stage.sample_avg_ms ? ` (${stage.sample_avg_ms.toFixed(0)} ms/frame)` : ""}`,
    );
  }

  console.log(`\nFull profile written to ${join(profileDir, "profile.json")}`);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
