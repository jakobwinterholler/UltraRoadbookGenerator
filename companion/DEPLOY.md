# Deploy Race Companion to Vercel

The Companion is a static Vite PWA. Vercel provides **HTTPS automatically** — required for iPhone install and service workers.

## One-click deploy (GitHub)

1. Push this repository to GitHub.
2. Click the button below (or use [vercel.com/new](https://vercel.com/new)):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USER%2FYOUR_REPO&project-name=race-companion&root-directory=companion)

Replace `YOUR_USER/YOUR_REPO` in the URL with your GitHub repository.

3. On the Vercel import screen, confirm:
   - **Root Directory:** `companion`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Click **Deploy**.

Every push to your default branch redeploys the app. The PWA uses **autoUpdate** — users get the new version on their next visit (or when the app checks for updates hourly).

## Manual deploy (Vercel CLI)

```bash
cd companion
npm install
npx vercel login
npx vercel --prod
```

Follow prompts. Link the project once; later deploys are just `npx vercel --prod`.

## Install on iPhone

1. Open your Vercel URL in **Safari** (not Chrome).
2. Tap **Share** → **Add to Home Screen**.
3. Launch **Companion** from the home screen icon.

The app runs full-screen (standalone) with your race data available offline after import.

## Offline behavior

| Data | Storage | Survives redeploy? |
|------|---------|-------------------|
| Imported race bundle | IndexedDB (on device) | Yes |
| App shell (JS/CSS) | Service worker cache | Updated on redeploy |
| Map tiles (after panning online) | Service worker cache | Up to 30 days |

**Before your ride:** import the race JSON while online. Optionally open the **Map** tab and pan along the route once to cache tiles.

**During your ride:** Resupply list and stop details work without network. Map works offline if tiles were cached; route line and stop markers always work.

## Environment variables

None required for MVP.

## Troubleshooting

- **PWA not installable:** Ensure you're on HTTPS (Vercel default) and using Safari on iOS.
- **Old version stuck:** Force-quit the app and reopen, or clear Safari website data for the domain.
- **Build fails on Vercel:** Confirm Root Directory is set to `companion`, not the repo root.
