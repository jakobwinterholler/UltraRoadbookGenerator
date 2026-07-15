# Ultra Roadbook v1.0 RC — Release Checklist

Last verified: 2026-07-14 (automated builds + API smoke; browser UI requires manual pass)

Legend: ✅ Verified | ⚠️ Partial | ❌ Not verified

---

## Infrastructure

| Check | Status | Notes |
|-------|--------|-------|
| Backend starts (`uvicorn` on :8000) | ⚠️ | Existing process responds at `/api/health`; fresh `uvicorn src.server:app` fails without `PYTHONPATH=src` |
| Desktop dev server (:5173) | ❌ | Not started this session |
| Companion dev server (:5174) | ✅ | HTTP 200 after `npm run dev` |
| Desktop production build | ✅ | `npm run build` passes (2026-07-14) |
| Companion production build | ⚠️ | `npx tsc -b` passes; full `vite build` not re-run this session |
| TypeScript compiles (desktop + companion) | ✅ | No TS errors in builds/tsc |
| Map matching script | ✅ | `node scripts/test_map_matching.mjs` passes |

---

## Desktop — Prepare the Race

| Workflow | Status | Notes |
|----------|--------|-------|
| Login (Google OAuth) | ❌ | Requires Supabase credentials + manual browser test |
| Session restore | ❌ | Not tested without live auth session |
| Import GPX | ❌ | UI not exercised; create API exists |
| Analysis pipeline | ⚠️ | Existing races have analysis; stream endpoint not re-run |
| Open race → Dashboard first | ✅ | Desktop `App.tsx` opens dashboard tab |
| Race dashboard (readiness, stats) | ⚠️ | API returns `dashboard_stats`; UI not visually confirmed |
| Readiness: READY/NOT READY header | ⚠️ | Implemented in `OverviewPage`; not visually confirmed |
| Readiness: estimated review time | ⚠️ | Implemented (~30 sec/stop); not visually confirmed |
| Stop confidence section | ⚠️ | `shared/race/stopConfidence.ts` + `StopConfidenceOverview` on dashboard; not visually confirmed |
| Stop verification | ❌ | Not exercised this session |
| Rename race | ⚠️ | API exists; not re-tested this session |
| Duplicate race | ⚠️ | API exists; not re-tested this session |
| Archive race | ⚠️ | API exists; not re-tested this session |
| Delete race (type name + checkbox) | ⚠️ | `DeleteRaceDialog` implemented; UI flow not exercised |
| Safe delete — no one-click | ✅ | Dialog requires typed name + checkbox (code review) |
| Sync status badge | ⚠️ | Component exists; live sync not tested |
| Sync now | ❌ | Requires authenticated Supabase session |
| Account page — all fields | ⚠️ | Fields present in code; not visually confirmed |
| Restart / session persistence | ❌ | Not tested |

---

## Desktop — Verification Review Queue (Part 6)

| Feature | Status | Notes |
|---------|--------|-------|
| Header "Verification Updates" + pending count | ⚠️ | Implemented in `CompanionVerificationReview`; not visually confirmed |
| Accept all / Reject all | ⚠️ | Bulk review loops pending items; not exercised |
| Review history (accepted/rejected) | ⚠️ | Stored in `companion_verification_history`; `GET ?status=history` returns 401 without auth (endpoint exists) |
| Summary labels (opening hours, water, closed) | ⚠️ | `shared/race/verificationSummary.ts`; not visually confirmed |
| Accept/reject per item | ⚠️ | Existing flow preserved; not exercised end-to-end |

---

## Companion — Execute the Race

| Workflow | Status | Notes |
|----------|--------|-------|
| Login | ❌ | Requires manual browser + Supabase |
| Session restore | ❌ | Not tested |
| Download race from cloud | ❌ | Requires auth |
| Open race → Map default tab | ⚠️ | `App.tsx` sets `tab` to `map` on open; not visually confirmed |
| Dashboard (race name, km, next resupply) | ⚠️ | `DashboardScreen` with GPS km, est. arrival, coffee in services; not visually confirmed |
| Map tab | ⚠️ | `MapScreen` exists; not exercised in browser |
| Resupply tab | ⚠️ | Auto-scroll, green checks; not exercised |
| GPS current km (no manual input) | ⚠️ | Race mode uses `gps.currentKm`; not exercised with real GPS |
| Stop details sheet | ⚠️ | `StopSheet` has hours, services, coffee, confidence; not exercised |
| Unsupported section sheet | ⚠️ | Distance, riding time, climbing, risk, water, carbs; code complete; not exercised |
| Verification mode + queue | ⚠️ | `VerificationSheet` queues to IndexedDB; offline sync on reconnect; not exercised |
| Offline verification queue | ⚠️ | `verificationQueue.ts` + `useVerificationSync.ts` implemented; airplane-mode test not run |
| Offline mode (PWA) | ✅ | Service worker builds; dev PWA enabled |
| Delete offline race | ❌ | Not exercised |
| Sign out | ❌ | Not exercised |
| Account page — all fields | ⚠️ | Enhanced with cloud/desktop/companion stats; not visually confirmed |
| No navigation / recording | ✅ | No nav or activity recording features in codebase |
| Premium UX polish | ⚠️ | Spacing/typography tweaks on dashboard, resupply, verification; not visually confirmed |

---

## Cloud Sync

| Workflow | Status | Notes |
|----------|--------|-------|
| Upload race | ❌ | Requires auth (`POST /api/sync/push`) |
| Download bundle | ❌ | Requires auth (`GET /api/sync/races/{id}/bundle`) |
| Submit verifications | ⚠️ | `POST /api/sync/verifications` exists; requires auth |
| List verifications (pending/history) | ⚠️ | `GET /api/sync/verifications?status=` returns 401 without token (endpoint wired) |
| Review verification | ⚠️ | `POST /api/sync/verifications/{id}/review` exists; not exercised |
| Update / revision bump | ❌ | Not tested |
| Delete from cloud | ❌ | Not tested |
| Conflict handling | ❌ | Not tested |
| Waiting-to-sync indicator | ⚠️ | `pendingSync.ts` + badge implemented; not exercised |

---

## Race Cards (My Races)

| Field | Status | Notes |
|-------|--------|-------|
| Distance + elevation | ✅ | Shown when `has_analysis` |
| Readiness score badge | ✅ | From `dashboard_stats` via API |
| Verified / unverified stops | ✅ | `RaceStatsGrid` |
| Supermarkets / water / fuel | ✅ | `RaceStatsGrid` |
| Longest unsupported gap | ✅ | `RaceStatsGrid` |
| Last verification date | ✅ | `formatLastVerification` |
| Cloud sync badge | ⚠️ | Wired in `MyRacesPage`; live sync not tested |
| Last modified | ✅ | Shows `updated_at` |

---

## Performance

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| `list_races` (4 races) | ~47 ms | ~2 ms | ✅ Cached `dashboard_stats` in `race.json` |
| Desktop bundle size | — | 2.6 MB JS | ⚠️ No code-splitting yet |
| Companion bundle size | — | 1.5 MB JS | ⚠️ No code-splitting yet |
| Map tile offline cache | — | 1500 tiles / 30 days | ⚠️ Documented in `KNOWN_LIMITATIONS.md`; not fully offline |

---

## Automated Test Results (2026-07-14)

| Command | Result |
|---------|--------|
| `npm run build` (frontend) | ✅ Pass |
| `npx tsc -b` (companion) | ✅ Pass |
| `node scripts/test_map_matching.mjs` | ✅ Pass |
| `python3 -m pytest tests/` | ❌ `pytest` not installed |
| `python3 -m unittest discover -s tests` | ⚠️ 14/15 pass; `test_companion_bundle` import path fails without `PYTHONPATH=src` |
| `tests/test_companion_verifications.py` | ✅ Pass (history storage verified) |
| `curl /api/health` | ✅ `{"status":"ok"}` |
| `curl /api/sync/verifications?status=history` | ✅ Returns 401 (auth required, route exists) |
| Browser test companion :5174 | ❌ Browser automation unavailable |

---

## Manual Testing Required

The following **must** be verified by a human with Supabase credentials configured:

1. Google sign-in on Desktop and Companion
2. Full GPX import → analysis → dashboard flow
3. Desktop stop verification round (verify, reject, complete)
4. **Companion verification → desktop review queue** (submit, accept all, reject all, history)
5. **Companion execution flow** (map default tab, GPS km, next resupply with est. arrival)
6. **Offline verification** (airplane mode submit, reconnect sync)
7. Cloud sync: upload, download, conflict, delete
8. Stop confidence badges on desktop dashboard
9. Delete race dialog (type name + checkbox)
10. Delete account flow on both apps
11. Visual polish pass on real devices (macOS Safari, iOS Safari)
