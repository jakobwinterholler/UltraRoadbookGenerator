#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { accessSync, constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  open,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ensureTileCache, hashSegment } from "./tile-cache.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

const quick = process.argv.includes("--quick");
const debugFrames = process.argv.includes("--debug-frames");
const fps = quick ? 12 : 24;
const durationS = quick ? 32 : 108;
const renderWidth = 2560;
const renderHeight = 1440;
const totalFrames = fps * durationS;
const segmentArg = readArg("--segment");
const outputArg = readArg("--output");
const framesArg = readArg("--frames-dir");
const cacheArg = readArg("--cache-dir");
const segmentSource = segmentArg ? resolve(segmentArg) : join(__dirname, "segment/capitals-hardest-climb.json");
const runtimeSegment = join(__dirname, "segment/runtime-segment.json");
const framesDir = framesArg ? resolve(framesArg) : join(__dirname, "output/frames");
const cacheDir = cacheArg ? resolve(cacheArg) : null;
const resumeFramesDir = cacheDir ? join(cacheDir, "frames") : framesDir;
const outputMp4 = outputArg ? resolve(outputArg) : join(__dirname, "output/capitals-hardest-climb.mp4");
const lockFile = join(__dirname, "output/.render.lock");
const bootTimeoutMs = 900_000;
const stallLogEveryMs = 15_000;

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

function emitProgress(event) {
  console.log(`PROGRESS:${JSON.stringify(event)}`);
}

async function readManifest(cacheRoot) {
  try {
    return JSON.parse(await readFile(join(cacheRoot, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

function startStaticServer(root, cacheRoot) {
  return new Promise((resolveServer) => {
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
    server.listen(0, "127.0.0.1", () => {
      resolveServer({ server, port: server.address().port });
    });
  });
}

function resolveFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    "ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  return "ffmpeg";
}

function spawnFfmpegPipe(outputPath, fpsValue) {
  const ffmpegBin = resolveFfmpeg();
  const args = [
    "-y",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "-framerate",
    String(fpsValue),
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
    "-movflags",
    "+faststart",
    outputPath,
  ];
  const child = spawn(ffmpegBin, args, { stdio: ["pipe", "inherit", "inherit"] });
  return child;
}

function runFfmpegFromPngSequence(inputPattern, outputPath, fpsValue) {
  return new Promise((resolve, reject) => {
    const ffmpegBin = resolveFfmpeg();
    const args = [
      "-y",
      "-framerate",
      String(fpsValue),
      "-i",
      inputPattern,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "16",
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      outputPath,
    ];
    const child = spawn(ffmpegBin, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function acquireRenderLock() {
  try {
    const handle = await open(lockFile, "wx");
    await handle.writeFile(String(process.pid));
    await handle.close();
    return async () => {
      await unlink(lockFile).catch(() => {});
    };
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Another render is already running. Wait for it to finish before starting a new one.");
    }
    throw error;
  }
}

async function waitForBoot(page) {
  const started = Date.now();
  let lastPhase = "";
  let lastLogAt = started;

  while (Date.now() - started < bootTimeoutMs) {
    const state = await page.evaluate(() => ({
      ready: window.__pocReady === true,
      phase: window.__pocBootPhase ?? "starting",
      loading: document.getElementById("loading")?.textContent ?? "",
      error: window.__pocBootError ?? null,
      progress: window.__pocBootProgress ?? null,
    }));

    if (state.ready) {
      emitProgress({ type: "boot", phase: "ready", status: "complete" });
      return;
    }

    if (state.error || String(state.loading).startsWith("Failed:")) {
      throw new Error(state.error || state.loading);
    }

    if (state.phase !== lastPhase) {
      emitProgress({
        type: "boot",
        phase: state.phase,
        status: "running",
        label: state.loading,
        progress: state.progress,
      });
      lastPhase = state.phase;
    } else if (Date.now() - lastLogAt >= stallLogEveryMs) {
      emitProgress({
        type: "boot",
        phase: state.phase,
        status: "running",
        label: state.loading,
        progress: state.progress,
        elapsed_ms: Date.now() - started,
      });
      lastLogAt = Date.now();
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Renderer boot timed out after ${Math.round(bootTimeoutMs / 1000)}s.`);
}

async function countCompletedFrames(dir, total, extension) {
  let frame = 0;
  while (frame < total) {
    try {
      await access(join(dir, `${String(frame).padStart(6, "0")}.${extension}`), constants.F_OK);
      frame += 1;
    } catch {
      break;
    }
  }
  return frame;
}

async function readCachedFrame(dir, frameIndex, extension) {
  return readFile(join(dir, `${String(frameIndex).padStart(6, "0")}.${extension}`));
}

async function writeCachedFrame(dir, frameIndex, extension, bytes) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${String(frameIndex).padStart(6, "0")}.${extension}`), bytes);
}

async function captureFrameImage(page, frameIndex, format) {
  return page.evaluate(
    async ({ index, imageFormat }) => window.__captureFrameImage(index, imageFormat),
    { index: frameIndex, imageFormat: format },
  );
}

async function main() {
  const releaseLock = await acquireRenderLock();

  try {
    emitProgress({
      type: "start",
      fps,
      duration_s: durationS,
      total_frames: totalFrames,
      output: outputMp4,
      capture_mode: debugFrames ? "debug-png" : "canvas-jpeg-pipe",
    });

    await mkdir(dirname(runtimeSegment), { recursive: true });
    await copyFile(segmentSource, runtimeSegment);
    await mkdir(dirname(outputMp4), { recursive: true });

    let segmentHash = null;
    if (cacheDir) {
      await mkdir(cacheDir, { recursive: true });
      const cacheResult = await ensureTileCache(cacheDir, segmentSource);
      segmentHash = cacheResult.segmentHash;
      emitProgress({
        type: "cache",
        status: cacheResult.cacheHit ? "hit" : "miss",
        tile_count: cacheResult.tileCount,
      });
    } else {
      const segment = JSON.parse(await readFile(segmentSource, "utf8"));
      segmentHash = hashSegment(segment);
    }

    const fresh = process.argv.includes("--fresh");
    const frameExtension = debugFrames ? "png" : "jpg";
    const activeFramesDir = debugFrames ? framesDir : resumeFramesDir;

    let startFrame = 0;
    if (!fresh) {
      startFrame = await countCompletedFrames(activeFramesDir, totalFrames, frameExtension);
      if (startFrame > 0) {
        emitProgress({
          type: "resume",
          from_frame: startFrame + 1,
          total: totalFrames,
          completed: startFrame,
        });
        console.log(`Resuming from frame ${startFrame + 1}/${totalFrames} (${startFrame} already captured)`);
      }
    }
    if (fresh && startFrame === 0) {
      await rm(activeFramesDir, { recursive: true, force: true });
    }
    await mkdir(activeFramesDir, { recursive: true });
    if (debugFrames) {
      await mkdir(framesDir, { recursive: true });
    }

    const { server, port } = await startStaticServer(__dirname, cacheDir);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: renderWidth, height: renderHeight },
      deviceScaleFactor: 1,
    });

    page.on("pageerror", (error) => {
      emitProgress({ type: "pageerror", detail: error.message });
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        emitProgress({ type: "console", detail: message.text() });
      }
    });

    let ffmpeg = null;
    try {
      const cacheQuery = cacheDir
        ? `&cache=1&cache-base=http://127.0.0.1:${port}/cache&segment-hash=${segmentHash}`
        : "";
      const pageUrl =
        `http://127.0.0.1:${port}/index.html?capture=1&fps=${fps}` +
        `&duration=${durationS}&segment=./segment/runtime-segment.json${cacheQuery}`;
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await waitForBoot(page);

      if (!debugFrames) {
        emitProgress({ type: "encode", status: "running", mode: "pipe" });
        ffmpeg = spawnFfmpegPipe(outputMp4, fps);
        await new Promise((resolve, reject) => {
          ffmpeg.on("error", reject);
          ffmpeg.on("spawn", resolve);
        });

        for (let frame = 0; frame < startFrame; frame += 1) {
          const cached = await readCachedFrame(activeFramesDir, frame, "jpg");
          ffmpeg.stdin.write(cached);
        }
      }

      for (let frame = startFrame; frame < totalFrames; frame += 1) {
        const started = Date.now();
        const imageFormat = debugFrames ? "png" : "jpeg";
        const imageBase64 = await captureFrameImage(page, frame, imageFormat);
        const imageBytes = Buffer.from(imageBase64, "base64");
        const elapsedMs = Date.now() - started;

        if (elapsedMs > 10_000) {
          emitProgress({
            type: "slow_frame",
            frame: frame + 1,
            elapsed_ms: elapsedMs,
          });
        }

        if (debugFrames) {
          const pngPath = join(framesDir, `${String(frame).padStart(6, "0")}.png`);
          await writeFile(pngPath, imageBytes);
        } else {
          await writeCachedFrame(activeFramesDir, frame, "jpg", imageBytes);
          ffmpeg.stdin.write(imageBytes);
        }

        if (frame % 24 === 0 || frame === totalFrames - 1) {
          emitProgress({
            type: "frame",
            current: frame + 1,
            total: totalFrames,
          });
          console.log(`Frame ${frame + 1}/${totalFrames}`);
        }
      }

      if (debugFrames) {
        emitProgress({ type: "encode", status: "running", mode: "png-sequence" });
        console.log("Encoding MP4…");
        await runFfmpegFromPngSequence(join(framesDir, "%06d.png"), outputMp4, fps);
      } else {
        ffmpeg.stdin.end();
        await new Promise((resolve, reject) => {
          ffmpeg.on("close", (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`ffmpeg exited with code ${code}`));
            }
          });
        });
      }
    } finally {
      if (ffmpeg && !ffmpeg.stdin.destroyed) {
        ffmpeg.stdin.destroy();
      }
      await browser.close();
      server.close();
    }

    emitProgress({ type: "complete", output: outputMp4 });
    console.log(`Done: ${outputMp4}`);
  } finally {
    await releaseLock();
  }
}

main().catch(async (error) => {
  emitProgress({ type: "error", detail: error.message });
  console.error(error);
  await unlink(lockFile).catch(() => {});
  process.exit(1);
});
