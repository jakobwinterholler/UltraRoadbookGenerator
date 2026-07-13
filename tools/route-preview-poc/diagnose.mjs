#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const pathname = decodeURIComponent(url.pathname);
        const filePath = join(root, pathname === "/" ? "/index.html" : pathname);
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

function elapsed(start) {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

async function main() {
  const { server, port } = await startStaticServer(__dirname);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
  page.on("pageerror", (error) => {
    console.log(`[pageerror] ${error.message}`);
    if (error.stack) {
      console.log(error.stack.split("\n").slice(0, 8).join("\n"));
    }
  });

  const t0 = Date.now();
  console.log(`[${elapsed(t0)}] goto domcontentloaded…`);
  await page.goto(`http://127.0.0.1:${port}/index.html?fps=12&duration=32`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  console.log(`[${elapsed(t0)}] domcontentloaded done`);

  for (let second = 0; second < 900; second += 5) {
    const state = await page.evaluate(() => ({
      ready: window.__pocReady === true,
      phase: window.__pocBootPhase ?? "unknown",
      loading: document.getElementById("loading")?.textContent ?? "",
      error: window.__pocBootError ?? null,
    }));
    console.log(
      `[${elapsed(t0)}] phase=${state.phase} ready=${state.ready} loading="${state.loading}"${state.error ? ` error=${state.error}` : ""}`,
    );
    if (state.ready || state.error) {
      break;
    }
    await page.waitForTimeout(5000);
  }

  await browser.close();
  server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
