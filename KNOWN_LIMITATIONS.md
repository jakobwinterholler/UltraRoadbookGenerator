# Ultra Roadbook v1.0 RC — Known Limitations

Honest list of what v1.0 RC does **not** do or does imperfectly.

---

## Product Scope

- **Not a bike computer.** No turn-by-turn navigation, no live GPS tracking, no ride recording.
- **Not Komoot/Strava.** No activity history, segments, social features, or community.
- **Desktop prepares; Companion executes.** Planning edits happen on desktop; companion is read-only race-day reference.

---

## Authentication & Account

- **Delete account** signs out and clears local data only. Permanent cloud account deletion requires contacting support.
- **Google OAuth only** in current build. Email/password not exposed in UI.
- **Companion ↔ Desktop device detection** relies on Supabase `user_metadata.devices` timestamps (30-day "connected" window). Not real-time presence.
- Cloud sync requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in both apps.

---

## Sync & Cloud

- **Conflict resolution** is last-write-wins by revision; no merge UI for conflicting edits.
- **Push is background-queued** by default (`/api/sync/push`); failures surface as "waiting to sync" badge.
- **Offline companion** requires prior download while online; no partial bundle streaming.
- **Verification queue** works offline (IndexedDB); submissions upload when back online. Map tiles are not fully cached offline — see Performance section.
- Cloud bundle endpoint requires authentication; no anonymous access.

---

## Readiness Score

- Score is **computed from actual verification data** — never faked — but threshold for "READY TO RIDE" is fixed at **85%**.
- Routes with zero supermarkets/fuel/water stops receive warnings and reduced scores even if that matches the route reality.
- **Estimated review time** assumes ~30 seconds per unverified stop; actual time varies.
- Opening hours coverage depends on OSM/Google data quality.

---

## Performance

- **First `list_races` call** after analysis still computes and caches dashboard stats (one-time cost per race).
- Desktop and Companion JS bundles are **>1.5 MB** each; no lazy route splitting yet.
- Map tile caching (Companion PWA) limited to 1500 tiles / 30 days.
- Large races (800+ km, 100+ stops) may feel slow on dashboard render and map load.

---

## Analysis & Data

- Analysis pipeline is **single-threaded per race**; re-analysis blocks until complete.
- POI/opening-hours data can be stale or missing for rural stops.
- Unsupported section risk bands use configurable rider assumptions but defaults may not match all riders.
- Route preview video generation is CPU-intensive and optional.

---

## UI / Platform

- Companion optimized for **portrait mobile**; landscape layout not polished.
- Desktop account and Companion account share data model but use **different visual themes** (light vs dark).
- PWA install prompts are browser-dependent; not all mobile browsers support add-to-homescreen equally.
- Browser automation testing was unavailable during RC pass; visual regressions possible.

---

## Build & Deploy

- Companion production build uses Workbox `mode: "development"` to avoid terser race in CI; service worker is not minified.
- Tailwind `content` config warns about broad `../shared/**/*.ts` pattern (build-time perf, not runtime).
- `pytest` not installed in default Python environment; backend tests require manual setup.
