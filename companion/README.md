# Race Companion

Offline race-day PWA — separate from [Ultra Roadbook](../).

**Deploy to Vercel:** see [DEPLOY.md](./DEPLOY.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjakobwinterholler%2FUltraRoadbookGenerator&project-name=companion&root-directory=companion)

## Screens

- **Map** — route, verified stops (green ✓), optional unverified stops
- **Resupply** — chronological list by km with current-km scroll

## Workflow

1. In **Ultra Roadbook** → Dashboard → **Export for Companion**
2. Open the deployed Companion URL (or run locally)
3. **Choose race file** → stored offline in IndexedDB

## Local dev

```bash
cd companion
npm install
npm run dev
```

Open http://127.0.0.1:5175

## Production build

```bash
npm run build
npm run preview
```

## iPhone install

Safari → your HTTPS URL → Share → **Add to Home Screen**

Requires deployment on Vercel (or any HTTPS host). See [DEPLOY.md](./DEPLOY.md).
