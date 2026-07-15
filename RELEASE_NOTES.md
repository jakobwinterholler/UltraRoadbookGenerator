# Ultra Roadbook v1.0 Release Candidate

**Date:** July 14, 2026  
**Version:** Desktop 0.15.0 · Companion 0.1.0

---

## Vision

**Desktop = prepare the race. Companion = execute the race.**

Ultra Roadbook helps ultra cyclists verify resupply stops, understand unsupported gaps, and carry a trusted offline plan on race day — without navigation, activity recording, or social features.

---

## What's New in RC

### Race Management
- Open, rename, duplicate, archive, and **safe delete** (type race name + acknowledgment checkbox)
- Race cards show distance, elevation, readiness score, verification stats, resupply counts, longest unsupported gap, last verification, sync status, and last modified date

### Readiness Dashboard (Desktop)
- **READY TO RIDE / NOT READY** header driven by real score (≥85% threshold)
- Checkmarks and warnings with specific reasons from `shared/race/readiness.ts`
- **Estimated review time** based on unverified stop count (~30 sec each)
- Opening a race lands on **Dashboard first**, not verification

### Companion Execution Dashboard
- Race name, distance, current km, next resupply with services/confidence/ride time
- Remaining verified stops and unsupported distance ahead
- Map / Resupply / Account tabs — no navigation or recording

### Stop & Unsupported Details
- Stop sheets: opening hours, distance from start/remaining, verification date, confidence, services, Google Maps, Street View, website, phone, status
- Unsupported sections: km, ride time, climbing, recommended water/carbs, Low/Medium/High risk with configurable rider assumptions

### Account Experience
- Desktop and Companion account pages aligned: avatar, Google account, email, connected since, last sync, cloud sync status, storage, race counts, device connection status, sync now, sign out, delete account
- Shared helpers: `accountDevices.ts`, `formatStorage.ts`

### Sync
- Waiting-to-sync state with `pendingSync.ts`
- Cloud sync status badges on race cards and account pages

### Performance
- **Dashboard stats cache** in `race.json` — `list_races` dropped from ~47 ms to ~2 ms (4 races, warm cache)
- Stats refresh automatically on analysis save and stop verification updates

### Build Fixes
- Companion production build: resolved vite-plugin-pwa / terser service worker write failure

---

## Upgrade Notes

- Existing races will populate `dashboard_stats` cache on first `list_races` after upgrade (one-time per race).
- Supabase migration `001_phase1.sql` should already be applied for cloud features.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for cloud sync.

---

## Known Issues

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

---

## Verification Status

See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for per-workflow verified/not-verified status.

**API-verified this RC:** health, list races, rename, duplicate, archive, production builds, dashboard stats cache.

**Requires manual verification:** OAuth login, full UI workflows, cloud sync end-to-end, offline companion on device.
