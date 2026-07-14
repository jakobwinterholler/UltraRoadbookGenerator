#!/usr/bin/env node
/**
 * Apply 001_phase1.sql via Supabase dashboard SQL editor.
 * Waits for manual GitHub/Google sign-in if needed, then pastes and runs SQL.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SQL = readFileSync(join(ROOT, "supabase/migrations/001_phase1.sql"), "utf8");
const SQL_URL =
  "https://supabase.com/dashboard/project/lxorwwrtxwffiwzdmtez/sql/new";
const LOGIN_WAIT_MS = 10 * 60 * 1000;

async function launchContext() {
  const profileDir = join(homedir(), ".ultra-roadbook-supabase-profile");
  try {
    return await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: false,
      viewport: { width: 1400, height: 900 },
    });
  } catch {
    const browser = await chromium.launch({
      channel: "chrome",
      headless: false,
    });
    return browser.newContext({ viewport: { width: 1400, height: 900 } }).then(async (ctx) => {
      ctx._ephemeralBrowser = browser;
      return ctx;
    });
  }
}

async function waitForSqlEditor(page) {
  const deadline = Date.now() + LOGIN_WAIT_MS;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes("/sign-in") || url.includes("github.com") || url.includes("google.com")) {
      console.log("Waiting for Supabase sign-in… Complete login in the browser window.");
      await page.waitForTimeout(3000);
      if (!url.includes("supabase.com")) {
        try {
          await page.goto(SQL_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
        } catch {
          // navigation may fail while OAuth is in flight
        }
      }
      continue;
    }

    const editor = page.locator(".monaco-editor textarea").first();
    try {
      await editor.waitFor({ state: "visible", timeout: 5000 });
      return editor;
    } catch {
      await page.waitForTimeout(2000);
    }
  }
  throw new Error("Timed out waiting for Supabase SQL editor after sign-in.");
}

async function main() {
  const context = await launchContext();
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(SQL_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  const editor = await waitForSqlEditor(page);
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.insertText(SQL);

  const runButton = page.getByRole("button", { name: /^Run$/i });
  await runButton.waitFor({ state: "visible", timeout: 30000 });
  await runButton.click();

  await page.waitForTimeout(8000);
  const body = await page.locator("body").innerText();
  if (/error|failed/i.test(body) && !/success|completed|no rows/i.test(body)) {
    console.error("SQL run may have failed. Page text snippet:");
    console.error(body.slice(0, 2000));
    await context.close();
    if (context._ephemeralBrowser) await context._ephemeralBrowser.close();
    process.exit(3);
  }

  console.log("Migration SQL executed in Supabase SQL editor.");
  await context.close();
  if (context._ephemeralBrowser) await context._ephemeralBrowser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
