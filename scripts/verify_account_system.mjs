#!/usr/bin/env node
/**
 * Automated account-system verification (no Google login).
 * Run: node scripts/verify_account_system.mjs
 */

const DESKTOP = "http://127.0.0.1:5173";
const COMPANION = "http://127.0.0.1:5175";
const API = "http://127.0.0.1:8000";

const results = [];

function pass(name, detail = "") {
  results.push({ status: "PASS", name, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ status: "FAIL", name, detail });
  console.log(`✗ ${name}${detail ? `: ${detail}` : ""}`);
}

function skip(name, detail = "") {
  results.push({ status: "SKIP", name, detail });
  console.log(`○ ${name}${detail ? `: ${detail}` : ""}`);
}

async function fetchText(url) {
  const res = await fetch(url);
  return { status: res.status, text: await res.text() };
}

async function main() {
  console.log("=== Account system verification ===\n");

  // Servers
  for (const [label, url] of [
    ["Backend", `${API}/api/settings`],
    ["Desktop", DESKTOP],
    ["Companion", COMPANION],
  ]) {
    try {
      const { status } = await fetchText(url);
      if (status === 200) pass(`${label} server responds`, url);
      else fail(`${label} server`, `HTTP ${status}`);
    } catch (err) {
      fail(`${label} server`, err.message);
    }
  }

  // Backend cloud config
  try {
    const { text } = await fetchText(`${API}/api/settings`);
    const settings = JSON.parse(text);
    if (settings.account?.cloud_sync_enabled === false) {
      fail("Cloud sync enabled", "SUPABASE_SERVICE_ROLE_KEY not set in .env");
    } else {
      pass("Cloud sync enabled");
    }
  } catch (err) {
    fail("Backend settings parse", err.message);
  }

  // Supabase OAuth URL generation (desktop)
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      skip("Supabase OAuth init", "Set VITE_SUPABASE_* env vars for this script");
    } else {
      const res = await fetch(`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(DESKTOP + "/")}`, {
        headers: { apikey: anonKey },
        redirect: "manual",
      });
      const location = res.headers.get("location") ?? "";
      if (location.includes("accounts.google.com")) {
        pass("Supabase OAuth redirect", "Google authorize URL returned");
      } else {
        fail("Supabase OAuth redirect", `Unexpected: ${location.slice(0, 120)}`);
      }
    }
  } catch (err) {
    fail("Supabase OAuth init", err.message);
  }

  // Companion HTML contains welcome content markers
  try {
    const { text } = await fetchText(COMPANION);
    if (text.includes("Race Companion")) pass("Companion HTML loads");
    else fail("Companion HTML loads");
  } catch (err) {
    fail("Companion HTML", err.message);
  }

  // Protected API returns 401 without token
  try {
    const res = await fetch(`${API}/api/sync/races`);
    if (res.status === 401) pass("Sync API requires auth", "401 without token");
    else fail("Sync API requires auth", `HTTP ${res.status}`);
  } catch (err) {
    fail("Sync API auth check", err.message);
  }

  skip("Google Sign In completion", "Requires manual Google credentials in browser");
  skip("Session persistence after restart", "Requires completed sign-in");
  skip("Profile avatar/name/email", "Requires completed sign-in");
  skip("Sign out", "Requires completed sign-in");
  skip("Cross-app same account", "Requires completed sign-in on both apps");
  skip("Race upload to Supabase", "Requires SUPABASE_SERVICE_ROLE_KEY + sign-in");
  skip("Companion race list from cloud", "Requires uploaded race + sign-in");
  skip("Offline download + airplane mode", "Requires signed-in download flow");

  console.log("\n=== Summary ===");
  const counts = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
  console.log(counts);
  process.exit(counts.FAIL > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
