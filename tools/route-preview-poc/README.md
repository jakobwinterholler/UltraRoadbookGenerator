# Route Preview POC

Single-sequence proof of concept: cinematic flythrough of the **hardest climb** from THE CAPITALS 2026.

## Quality settings (v2)

- Terrain tiles: zoom **14** (was 12)
- Mesh: **480×480** vertices with bilinear DEM sampling
- Render: **2560×1440** @ 24 fps, ~72 s full sequence
- Overlay: landscape-first storytelling (no text for first ~18 s)

- Satellite imagery + 3D terrain
- Cinematic camera along the climb
- Purple route line
- One typography overlay (fade in / hold / fade out)

## Render

```bash
cd tools/route-preview-poc
npm install
npx playwright install chromium

# Fast draft (~18 s)
npm run render:quick

# Full sequence (~60 s)
npm run render
```

Requires **ffmpeg** on your PATH.

Output:

- `tools/route-preview-poc/output/capitals-hardest-climb.mp4`
- copied to `frontend/public/poc/capitals-hardest-climb.mp4` for in-app playback

## Regenerate segment data

```bash
npm run prepare-segment
```

## Preview in browser (live scene, no capture)

Open `index.html` via the static server used by `capture.mjs`, or run:

```bash
python3 -m http.server 8765
```

Then visit `http://127.0.0.1:8765/index.html` from the `tools/route-preview-poc` directory.

## Attribution

- Imagery © Esri — World Imagery
- Elevation © Mapzen / AWS Terrain Tiles (Terrarium)
