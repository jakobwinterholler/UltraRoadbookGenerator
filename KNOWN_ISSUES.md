# Known Issues

Single source of truth for bugs, risks, and deferred work. Every issue has a
**Priority**, a **Status**, and either a **Fixed in** version or a **Deferred
reason**. Nothing gets lost.

Priority: **P0** = blocks release / can break trust mid-race · **P1** = important
before App Store · **P2** = quality / polish · **P3** = nice-to-have.

Status: `open` · `in-progress` · `fixed` · `deferred` · `wontfix`.

---

## Fixed in v0.7 "Release Hardening"

### RH-01 — Newer cloud revision wiped the offline bundle
- **Description:** When the cloud `companion_revision` advanced, the companion
  race-list refresh deleted (`invalidateStaleBundle`) the working offline bundle
  and marked the race as "needs download". A rider at an aid station with signal
  could lose their offline route until a re-download completed — catastrophic if
  connectivity then dropped.
- **Priority:** P0 · **Status:** fixed · **Fixed in:** v0.7
- **Fix:** `resolveOfflineReady` now keeps the downloaded bundle openable offline
  and only surfaces the update via the revision mismatch. Bundles are still
  invalidated when genuinely missing/corrupt.

### RH-02 — Background sync could swap the active race's bundle
- **Description:** `useAutoCloudSync` auto-downloaded updated bundles in the
  background, including for the race the rider currently had open, changing data
  under them mid-execution.
- **Priority:** P0 · **Status:** fixed · **Fixed in:** v0.7
- **Fix:** Background auto-download now skips the active race
  (`liveBundleRef.current`). The in-race update banner still lets the rider apply
  it deliberately.

### RH-03 — Screen slept during race execution
- **Description:** No Screen Wake Lock, so the phone screen slept mid-ride and
  the rider lost the live map/next-stop glance.
- **Priority:** P1 · **Status:** fixed · **Fixed in:** v0.7
- **Fix:** `useWakeLock` acquires a screen wake lock while a race is open and
  re-acquires it on visibility change. Non-fatal on unsupported devices.

### RH-04 — Map matching snapped backward on loops / out-and-backs
- **Description:** `matchPositionToRoute` did a global nearest-point search, so on
  self-intersecting routes (loops, lollipops, out-and-backs) GPS could snap to a
  spatially-overlapping segment at a different distance, jumping `currentKm`
  backward or forward.
- **Priority:** P1 · **Status:** fixed · **Fixed in:** v0.7
- **Fix:** Matching now prefers candidates within a km-window around the last
  known position (2 km back / 6 km ahead), falling back to a global search for the
  first fix or when rejoining after leaving the route.

### RH-05 — GPS status only visible on the Resupply tab
- **Description:** The GPS status badge (Acquiring/Active/Degraded/Lost/Denied)
  only rendered on Resupply; on the Map tab the rider had no signal on whether
  position tracking was healthy.
- **Priority:** P1 · **Status:** fixed · **Fixed in:** v0.7
- **Fix:** The execution header (km + GPS badge) now also shows on the Map tab.

### RH-06 — Destructive dev tool exposed to riders
- **Description:** "Reset Local Race Cache" (wipes IndexedDB + bundles + SW
  caches) was always visible in Account → Developer. A mis-tap could delete all
  offline races with no confirmation.
- **Priority:** P1 · **Status:** fixed · **Fixed in:** v0.7
- **Fix:** The Developer section is hidden until the version row is tapped 7×
  (reveal resets on reload).

### RH-07 — No server-side GPX upload size limit
- **Description:** All GPX upload endpoints did `await file.read()` with no cap,
  reading arbitrarily large uploads fully into memory (DoS / OOM risk on the
  public API).
- **Priority:** P1 · **Status:** fixed · **Fixed in:** v0.7
- **Fix:** `_read_gpx_upload` streams in 1 MB chunks with a 60 MB hard cap
  (413 on exceed) and checks the size hint up front.

---

## Open / Deferred

### KI-07 — Haptics are a no-op on iOS Safari / installed PWA
- **Description:** The companion haptics utility (`companion/src/lib/haptics.ts`)
  uses the Web Vibration API, which iOS Safari and installed PWAs do not
  implement. Haptic feedback therefore fires on Android but is a graceful no-op
  on iPhone — the actual target device.
- **Priority:** P3 · **Status:** open
- **Notes:** No reliable web API for iOS haptics today. Utility is centralized so
  it "just works" if/when support arrives, or if wrapped natively later.

### KI-08 — Companion Map tab remounts (map re-init) on every tab switch
- **Description:** The companion workspace renders tab content with `key={tab}`,
  so returning to the Map tab tears down and recreates the MapLibre instance,
  costing time and a visible flash mid-race.
- **Priority:** P2 · **Status:** open
- **Notes:** Fix needs a keep-alive layout (mount tabs once, toggle visibility).
  Deferred — non-trivial state/layout change; verify GPS + map lifecycle.

### KI-09 — StopDetailSheet lacks visible-state enter/exit + drag-to-dismiss
- **Description:** The verification `StopDetailSheet` is mounted conditionally
  (no exit animation, no drag-to-dismiss) unlike the shared `BottomSheet`.
- **Priority:** P3 · **Status:** open
- **Notes:** Bring it onto the shared `BottomSheet` (or add visible-state) for a
  consistent native feel. Deferred to avoid churn on a secondary surface.



### KI-01 — Public API multi-tenant isolation for local planning endpoints
- **Description:** The `/api/races/*` local planning endpoints use a filesystem
  race store with an optional user and no per-user ownership checks. Safe for the
  single-user desktop app, but if the same server is exposed publicly it is not
  multi-tenant safe. The sync endpoints (`/api/sync/*`) do require a user.
- **Priority:** P0 (if planning endpoints are ever public) · **Status:** open
- **Notes:** Needs a design decision: run desktop planning strictly local, and
  have the public Render API expose only `/api/sync/*` + import + health (e.g. via
  a `CLOUD_API` mode flag). Not changed this batch to avoid breaking desktop.

### KI-02 — Bundle checksum self-heal accepts recomputed checksum
- **Description:** On checksum mismatch the client recomputes and accepts the
  bundle rather than failing closed. This is intentional for locally-mutated
  bundles (verification patches recompute the checksum), but it means a corrupted
  download isn't rejected on the download path.
- **Priority:** P1 · **Status:** open
- **Notes:** Fix should verify against the *cloud-provided* checksum on the
  download path while still allowing recompute for local mutations. Deferred:
  needs care to avoid breaking verification persistence.

### KI-03 — No manual "I am here" km override when GPS is denied/unavailable
- **Description:** With GPS denied/unavailable, `currentKm` stays at 0 and the
  next-stop / resupply views assume the start of the route. Status is now visible
  (RH-05) but the rider can't tell the app where they are.
- **Priority:** P2 · **Status:** deferred
- **Deferred reason:** New feature, not a regression. Track for a focused UX pass.

### KI-04 — Auto-scroll / next-stop trust when position is unknown
- **Description:** Resupply auto-scroll and "next stop" pick from km 0 when
  position is unknown, which can mislead. Tied to KI-03.
- **Priority:** P2 · **Status:** deferred
- **Deferred reason:** Address together with KI-03 (manual km override).

### KI-05 — Physical-device QA outstanding for race-day workflow
- **Description:** GPX import, race deletion, persistence, sync, wake lock,
  map-matching on loops, and offline continuation need verification on a physical
  iPhone (PWA / Safari) before production deploy.
- **Priority:** P0 (release gate) · **Status:** open
- **Notes:** Cannot be verified from the dev environment. Required before deploy.

### KI-06 — Render analysis API deployment not verified live
- **Description:** Companion GPX import proxies `/api/*` to the Render FastAPI
  service via `companion/vercel.json`. The service must be deployed and healthy
  (`/api/health`) for import to work.
- **Priority:** P0 (release gate) · **Status:** open
- **Notes:** Use `scripts/verify_production_api.sh`. Manual one-time Render
  Blueprint deploy required.

---

## How to use this file

- Add an entry the moment a bug or risk is found — don't rely on memory.
- When fixing, move the entry to the "Fixed in <version>" section with the fix
  summary. When deferring, record the **Deferred reason**.
- Keep P0/P1 items at the top of the open list.
