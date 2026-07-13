import * as THREE from "../node_modules/three/build/three.module.js";

const SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TERRAIN_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const ROUTE_CORE = 0x6d28d9;
const ROUTE_HALO = 0xc4b5fd;
const TILE_SIZE = 256;
const TERRAIN_ZOOM = 14;
const TERRAIN_SEGMENTS = 480;
const EXAGGERATION = 1.55;
const ROUTE_TUBE_SEGMENTS = 480;
const RENDER_WIDTH = 2560;
const RENDER_HEIGHT = 1440;

const urlParams = new URLSearchParams(window.location.search);
let FPS = Number(urlParams.get("fps")) || 24;
let DURATION_S = Number(urlParams.get("duration")) || 108;

const ROUTE_OFFSET_M = 3.5;

const overlayEl = document.getElementById("overlay");
const climbStripEl = document.getElementById("climb-strip");
const loadingEl = document.getElementById("loading");
const profileMode = urlParams.get("profile") === "1";
const captureMode = urlParams.get("capture") === "1";
const cacheBase = urlParams.get("cache-base");
const useTileCache = urlParams.get("cache") === "1" && cacheBase;
const jpegQuality = Number(urlParams.get("jpeg-quality")) || 0.92;
const segmentHash = urlParams.get("segment-hash") || "";

let compositeCanvas;
let compositeCtx;

window.__pocBootTimings = { phases: {}, started_at: performance.now() };

function markBootPhase(name, extra = {}) {
  const now = performance.now();
  window.__pocBootTimings.phases[name] = {
    at_ms: now - window.__pocBootTimings.started_at,
    ...extra,
  };
}

function setBootPhase(phase, message) {
  window.__pocBootPhase = phase;
  if (message) {
    loadingEl.textContent = message;
  }
}

let renderer;
let scene;
let camera;
let terrainMesh;
let routeMeshes = [];
let heightSampler;
let cameraPositions = [];
let lookTargets = [];
let segmentData;
let climbProfile = null;
let totalFrames = FPS * DURATION_S;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function smootherstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function formatKm(value) {
  return `${value.toFixed(1)} km`;
}

function formatMeters(value) {
  return `${Math.round(value)} m`;
}

function formatGradient(value) {
  return `${value.toFixed(1)}%`;
}

function lonLatToTile(lon, lat, zoom) {
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  );
  return { x, y, z: zoom };
}

function lonLatToMeters(lon, lat, originLon, originLat) {
  const cosLat = Math.cos((originLat * Math.PI) / 180);
  const x = (lon - originLon) * cosLat * 111_320;
  const z = -(lat - originLat) * 110_540;
  return { x, z };
}

function decodeTerrarium(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

function tile2lonLat(tileX, tileY, zoom) {
  const n = 2 ** zoom;
  const lon = (tileX / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lon, lat };
}

async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function tileCacheUrl(kind, z, x, y) {
  const ext = kind === "sat" ? "jpg" : "png";
  return `${cacheBase}/${kind}/${z}/${x}/${y}.${ext}`;
}

async function loadDerivedCache(name) {
  if (!cacheBase || !segmentHash) {
    return null;
  }
  try {
    const response = await fetch(`${cacheBase}/derived/${name}?hash=${segmentHash}`);
    if (!response.ok) {
      return null;
    }
    return response;
  } catch {
    return null;
  }
}

async function saveDerivedCache(name, body, contentType = "application/json") {
  if (!cacheBase || !segmentHash) {
    return;
  }
  try {
    await fetch(`${cacheBase}/derived/${name}?hash=${segmentHash}`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
  } catch (error) {
    console.warn(`Failed to save derived cache ${name}:`, error);
  }
}

function populateOverlay(data) {
  overlayEl.querySelector(".eyebrow").textContent = data.overlay.title;
  overlayEl.querySelector(".name").textContent = data.overlay.name;
  overlayEl.querySelector(".stats").innerHTML = data.overlay.stats_lines
    .map((line) => `<div>${line}</div>`)
    .join("");

  const water = data.overlay.last_verified_water;
  overlayEl.querySelector(".water-value").textContent = water
    ? `${water.poi_name}, km ${water.km}`
    : "None verified before this climb";
  overlayEl.hidden = false;
}

function overlayOpacity(timeS) {
  const fadeIn = smootherstep(32, 38, timeS);
  const fadeOut = 1 - smootherstep(78, 86, timeS);
  return clamp(fadeIn * fadeOut, 0, 1);
}

function climbStripOpacity(timeS, km, climb) {
  const fadeIn = smootherstep(26, 36, timeS);
  const fadeOut = 1 - smootherstep(94, 102, timeS);
  const nearClimb = km >= climb.start_km - 2.5;
  const approach = nearClimb ? 1 : smootherstep(climb.start_km - 8, climb.start_km - 2.5, km);
  return clamp(fadeIn * fadeOut * approach, 0, 1) * 0.82;
}

function updateOverlay(timeS) {
  const opacity = overlayOpacity(timeS);
  overlayEl.style.opacity = String(opacity);
  overlayEl.style.transform = `translateY(${lerp(22, 0, opacity)}px)`;
}

function sampleDemBilinear(demData, width, height, u, v) {
  const fu = clamp(u, 0, 1) * (width - 1);
  const fv = clamp(v, 0, 1) * (height - 1);
  const x0 = Math.floor(fu);
  const y0 = Math.floor(fv);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fu - x0;
  const ty = fv - y0;

  function px(x, y) {
    const index = (y * width + x) * 4;
    return decodeTerrarium(demData[index], demData[index + 1], demData[index + 2]);
  }

  const h00 = px(x0, y0);
  const h10 = px(x1, y0);
  const h01 = px(x0, y1);
  const h11 = px(x1, y1);
  const hx0 = lerp(h00, h10, tx);
  const hx1 = lerp(h01, h11, tx);
  return lerp(hx0, hx1, ty);
}

function buildClimbProfile(track, climb) {
  const points = track
    .filter((point) => point.km >= climb.start_km - 0.05 && point.km <= climb.end_km + 0.05)
    .map((point) => ({
      km: point.km,
      ele_m: point.ele_m,
      distIntoKm: Math.max(0, point.km - climb.start_km),
    }));

  if (points.length === 0) {
    climbStripEl.hidden = true;
    return null;
  }

  const startEle = points[0].ele_m;
  const endEle = points.at(-1).ele_m;
  const minEle = Math.min(...points.map((point) => point.ele_m));
  const maxEle = Math.max(...points.map((point) => point.ele_m));

  const width = 1124;
  const height = 54;
  const padding = 6;
  const span = Math.max(1, maxEle - minEle);

  const coords = points.map((point, index) => {
    const x = padding + (point.distIntoKm / climb.length_km) * (width - padding * 2);
    const y = height - padding - ((point.ele_m - minEle) / span) * (height - padding * 2);
    return { x, y, index };
  });

  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const lastCoord = coords.at(-1);
  const firstCoord = coords[0];
  const fillPath = `${linePath} L${lastCoord.x},${height - padding} L${firstCoord.x},${height - padding} Z`;

  document.getElementById("profile-line").setAttribute("d", linePath);
  document.getElementById("profile-fill").setAttribute("d", fillPath);

  climbStripEl.hidden = false;

  return {
    points,
    startEle,
    endEle,
    minEle,
    maxEle,
    coords,
    width,
    height,
    padding,
    span,
  };
}

function interpolateTrack(km) {
  const track = segmentData.track;
  if (km <= track[0].km) {
    return track[0];
  }
  if (km >= track.at(-1).km) {
    return track.at(-1);
  }

  for (let index = 0; index < track.length - 1; index += 1) {
    const current = track[index];
    const next = track[index + 1];
    if (km >= current.km && km <= next.km) {
      const blend = (km - current.km) / (next.km - current.km);
      return {
        lat: lerp(current.lat, next.lat, blend),
        lon: lerp(current.lon, next.lon, blend),
        km,
        ele_m: lerp(current.ele_m, next.ele_m, blend),
      };
    }
  }

  return track.at(-1);
}

function gradientLast100m(km) {
  const startKm = Math.max(segmentData.track[0].km, km - 0.1);
  const start = interpolateTrack(startKm);
  const end = interpolateTrack(km);
  const rise = end.ele_m - start.ele_m;
  const runM = Math.max(1, (km - startKm) * 1000);
  return (rise / runM) * 100;
}

function updateClimbStrip(timeS, progress) {
  const { km, inClimb, climbT } = progress;
  const climb = segmentData.climb;
  const opacity = climbStripOpacity(timeS, km, climb);

  climbStripEl.style.opacity = String(opacity);
  climbStripEl.style.transform = `translateX(-50%) translateY(${lerp(12, 0, opacity)}px)`;

  if (opacity <= 0.01 || !climbProfile) {
    return;
  }

  const distIntoKm = clamp(km - climb.start_km, 0, climb.length_km);
  const distRemainingKm = clamp(climb.end_km - km, 0, climb.length_km);
  const current = interpolateTrack(km);
  const gained = Math.max(0, current.ele_m - climbProfile.startEle);
  const remaining = Math.max(0, climbProfile.endEle - current.ele_m);
  const gradient = gradientLast100m(km);

  document.getElementById("metric-distance").textContent = `${distIntoKm.toFixed(1)} km in`;
  document.getElementById("metric-distance-sub").textContent = `${distRemainingKm.toFixed(1)} km remaining`;
  document.getElementById("metric-elevation").textContent = `+${Math.round(gained)} m`;
  document.getElementById("metric-elevation-sub").textContent = `+${Math.round(remaining)} m to go`;
  document.getElementById("metric-altitude").textContent = formatMeters(current.ele_m);
  document.getElementById("metric-altitude-sub").textContent = inClimb ? climb.name : "Approaching climb";
  document.getElementById("metric-gradient").textContent = formatGradient(gradient);

  const markerT = clamp(distIntoKm / climb.length_km, 0, 1);
  const markerX = climbProfile.padding + markerT * (climbProfile.width - climbProfile.padding * 2);
  const markerY = climbProfile.height - climbProfile.padding -
    ((current.ele_m - climbProfile.minEle) / climbProfile.span) * (climbProfile.height - climbProfile.padding * 2);

  const marker = document.getElementById("profile-marker");
  marker.setAttribute("cx", String(markerX));
  marker.setAttribute("cy", String(markerY));
}

async function buildTerrain(track) {
  loadingEl.textContent = "Loading high-resolution terrain…";

  const lats = track.map((point) => point.lat);
  const lons = track.map((point) => point.lon);
  const bounds = {
    south: Math.min(...lats),
    north: Math.max(...lats),
    west: Math.min(...lons),
    east: Math.max(...lons),
  };

  const pad = 0.018;
  bounds.south -= pad;
  bounds.north += pad;
  bounds.west -= pad;
  bounds.east += pad;

  const originLat = (bounds.south + bounds.north) / 2;
  const originLon = (bounds.west + bounds.east) / 2;

  const minTile = lonLatToTile(bounds.west, bounds.north, TERRAIN_ZOOM);
  const maxTile = lonLatToTile(bounds.east, bounds.south, TERRAIN_ZOOM);
  const tilesX = maxTile.x - minTile.x + 1;
  const tilesY = maxTile.y - minTile.y + 1;

  const satCanvas = document.createElement("canvas");
  satCanvas.width = tilesX * TILE_SIZE;
  satCanvas.height = tilesY * TILE_SIZE;
  const satCtx = satCanvas.getContext("2d");
  satCtx.imageSmoothingEnabled = true;
  satCtx.imageSmoothingQuality = "high";

  const demCanvas = document.createElement("canvas");
  demCanvas.width = tilesX * TILE_SIZE;
  demCanvas.height = tilesY * TILE_SIZE;
  const demCtx = demCanvas.getContext("2d");
  demCtx.imageSmoothingEnabled = false;

  const tileCount = tilesX * tilesY;
  let loaded = 0;
  let satFetchMs = 0;
  let demFetchMs = 0;
  const tileDownloadStarted = performance.now();

  const tileJobs = [];
  for (let tileY = minTile.y; tileY <= maxTile.y; tileY += 1) {
    for (let tileX = minTile.x; tileX <= maxTile.x; tileX += 1) {
      tileJobs.push({
        drawX: (tileX - minTile.x) * TILE_SIZE,
        drawY: (tileY - minTile.y) * TILE_SIZE,
        tileX,
        tileY,
        satUrl: useTileCache
          ? tileCacheUrl("sat", TERRAIN_ZOOM, tileX, tileY)
          : SATELLITE_URL.replace("{z}", String(TERRAIN_ZOOM))
              .replace("{x}", String(tileX))
              .replace("{y}", String(tileY)),
        demUrl: useTileCache
          ? tileCacheUrl("dem", TERRAIN_ZOOM, tileX, tileY)
          : TERRAIN_URL.replace("{z}", String(TERRAIN_ZOOM))
              .replace("{x}", String(tileX))
              .replace("{y}", String(tileY)),
      });
    }
  }

  const batchSize = 8;
  for (let index = 0; index < tileJobs.length; index += batchSize) {
    const batch = tileJobs.slice(index, index + batchSize);
    await Promise.all(
      batch.map(async (job) => {
        const satStarted = performance.now();
        const satImage = await fetchImage(job.satUrl);
        satFetchMs += performance.now() - satStarted;
        const demStarted = performance.now();
        const demImage = await fetchImage(job.demUrl);
        demFetchMs += performance.now() - demStarted;
        satCtx.drawImage(satImage, job.drawX, job.drawY);
        demCtx.drawImage(demImage, job.drawX, job.drawY);
      }),
    );
    loaded += batch.length;
    loadingEl.textContent = `Loading terrain tiles ${loaded}/${tileCount}…`;
    window.__pocBootProgress = { loaded, total: tileCount };
  }

  const tileDownloadMs = performance.now() - tileDownloadStarted;
  markBootPhase("tile_download", {
    duration_ms: tileDownloadMs,
    tile_count: tileCount,
    sat_fetch_ms: satFetchMs,
    dem_fetch_ms: demFetchMs,
  });

  const demData = demCtx.getImageData(0, 0, demCanvas.width, demCanvas.height).data;
  const tileNorth = tile2lonLat(minTile.x, minTile.y, TERRAIN_ZOOM).lat;
  const tileSouth = tile2lonLat(minTile.x, minTile.y + tilesY, TERRAIN_ZOOM).lat;
  const tileWest = tile2lonLat(minTile.x, minTile.y, TERRAIN_ZOOM).lon;
  const tileEast = tile2lonLat(minTile.x + tilesX, minTile.y, TERRAIN_ZOOM).lon;

  const widthM = Math.abs(
    lonLatToMeters(tileEast, originLat, originLon, originLat).x -
      lonLatToMeters(tileWest, originLat, originLon, originLat).x,
  );
  const depthM = Math.abs(
    lonLatToMeters(originLon, tileSouth, originLon, originLat).z -
      lonLatToMeters(originLon, tileNorth, originLon, originLat).z,
  );

  const geometry = new THREE.PlaneGeometry(widthM, depthM, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  function sampleHeightMeters(x, z) {
    const lon = originLon + x / (Math.cos((originLat * Math.PI) / 180) * 111_320);
    const lat = originLat - z / 110_540;
    const u = (lon - tileWest) / (tileEast - tileWest);
    const v = (tileNorth - lat) / (tileNorth - tileSouth);
    const elevation = sampleDemBilinear(demData, demCanvas.width, demCanvas.height, u, v);
    return elevation * EXAGGERATION;
  }

  const meshBuildStarted = performance.now();
  const cachedMeshResponse = await loadDerivedCache("terrain-positions.bin");
  let loadedFromCache = false;
  if (cachedMeshResponse) {
    const cachedPositions = new Float32Array(await cachedMeshResponse.arrayBuffer());
    if (cachedPositions.length === positions.count * 3) {
      positions.array.set(cachedPositions);
      positions.needsUpdate = true;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const z = positions.getZ(index);
        uvs.setXY(index, (x / widthM) + 0.5, 1 - (z / depthM + 0.5));
      }
      loadedFromCache = true;
    }
  }

  if (!loadedFromCache) {
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      positions.setY(index, sampleHeightMeters(x, z));
      uvs.setXY(index, (x / widthM) + 0.5, 1 - (z / depthM + 0.5));
    }
    saveDerivedCache(
      "terrain-positions.bin",
      positions.array.slice(0, positions.count * 3).buffer,
      "application/octet-stream",
    );
  }

  geometry.computeVertexNormals();
  geometry.attributes.normal.needsUpdate = true;

  const texture = new THREE.CanvasTexture(satCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = false;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0.015,
  });

  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.receiveShadow = true;

  heightSampler = sampleHeightMeters;
  markBootPhase("dem_mesh", {
    duration_ms: performance.now() - meshBuildStarted,
    vertex_count: positions.count,
  });
  return { originLat, originLon };
}

function hugTerrainPoint(x, z, offset = ROUTE_OFFSET_M) {
  return new THREE.Vector3(x, heightSampler(x, z) + offset, z);
}

function hugRoutePoints(points) {
  return points.map((point) => hugTerrainPoint(point.x, point.z));
}

function documentaryFraming(routeT, km, climb) {
  const inClimb = km >= climb.start_km && km <= climb.end_km;
  const climbT = inClimb
    ? clamp((km - climb.start_km) / (climb.end_km - climb.start_km), 0, 1)
    : 0;

  let altitudeAgl = 520;
  let lateral = 420;
  let lookAheadSteps = 42;

  if (routeT < 0.2) {
    const t = smootherstep(0, 0.2, routeT);
    altitudeAgl = lerp(980, 760, t);
    lateral = lerp(720, 560, t);
    lookAheadSteps = lerp(72, 58, t);
  } else if (routeT < 0.38) {
    const t = smootherstep(0.2, 0.38, routeT);
    altitudeAgl = lerp(760, 580, t);
    lateral = lerp(560, 420, t);
    lookAheadSteps = lerp(58, 46, t);
  } else if (inClimb && climbT < 0.4) {
    const t = smootherstep(0, 0.4, climbT);
    altitudeAgl = lerp(580, 460, t);
    lateral = lerp(420, 340, t);
    lookAheadSteps = lerp(46, 36, t);
  } else if (inClimb && climbT < 0.62) {
    const t = smootherstep(0.4, 0.62, climbT);
    altitudeAgl = lerp(460, 820, t);
    lateral = lerp(340, 520, t);
    lookAheadSteps = lerp(36, 64, t);
  } else if (inClimb) {
    const t = smootherstep(0.62, 1, climbT);
    altitudeAgl = lerp(820, 540, t);
    lateral = lerp(520, 380, t);
    lookAheadSteps = lerp(64, 44, t);
  } else if (routeT > 0.88) {
    const t = smootherstep(0.88, 1, routeT);
    altitudeAgl = lerp(560, 720, t);
    lateral = lerp(400, 500, t);
    lookAheadSteps = lerp(44, 56, t);
  }

  return { altitudeAgl, lateral, lookAheadSteps };
}

function dedupeRoutePoints(points, minDistanceM = 2.5) {
  if (points.length === 0) {
    return points;
  }

  const deduped = [points[0].clone()];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const last = deduped.at(-1);
    if (last.distanceTo(point) >= minDistanceM) {
      deduped.push(point.clone());
    }
  }

  if (deduped.length === 1 && points.length > 1) {
    deduped.push(points.at(-1).clone());
  }

  return deduped;
}

function buildRouteCurve(track, originLon, originLat) {
  const seedPoints = dedupeRoutePoints(
    track.map((point) => {
      const { x, z } = lonLatToMeters(point.lon, point.lat, originLon, originLat);
      return hugTerrainPoint(x, z);
    }),
  );

  if (seedPoints.length < 2) {
    throw new Error("Route track does not contain enough points to build a preview.");
  }

  const seedCurve = new THREE.CatmullRomCurve3(seedPoints, false, "catmullrom", 0.12);
  const densePoints = dedupeRoutePoints(hugRoutePoints(seedCurve.getSpacedPoints(1200)), 1.5);
  if (densePoints.length < 2) {
    throw new Error("Route curve collapsed while sampling the track.");
  }
  const curve = new THREE.CatmullRomCurve3(densePoints, false, "catmullrom", 0.1);
  const routePoints = hugRoutePoints(curve.getSpacedPoints(900));
  if (routePoints.length < 2) {
    throw new Error("Route curve did not produce enough render points.");
  }
  return routePoints;
}

function buildTubeGeometries(curve) {
  const tubularSegments = Math.min(
    ROUTE_TUBE_SEGMENTS,
    Math.max(48, Math.floor(curve.getLength() / 45)),
  );

  try {
    return {
      tubularSegments,
      haloGeometry: new THREE.TubeGeometry(curve, tubularSegments, 18, 8, false),
      coreGeometry: new THREE.TubeGeometry(curve, tubularSegments, 8.5, 8, false),
    };
  } catch (error) {
    const fallbackSegments = Math.max(24, Math.floor(tubularSegments / 2));
    return {
      tubularSegments: fallbackSegments,
      haloGeometry: new THREE.TubeGeometry(curve, fallbackSegments, 18, 6, false),
      coreGeometry: new THREE.TubeGeometry(curve, fallbackSegments, 8.5, 6, false),
    };
  }
}

async function buildRouteMeshes(track, originLon, originLat, climb) {
  const routeStarted = performance.now();
  const routePoints = buildRouteCurve(track, originLon, originLat);
  const curveStarted = performance.now();
  const huggedCurve = new THREE.CatmullRomCurve3(routePoints, false, "catmullrom", 0.1);
  const { haloGeometry, coreGeometry } = buildTubeGeometries(huggedCurve);
  markBootPhase("route_tubes", { duration_ms: performance.now() - curveStarted });

  routeMeshes = [
    new THREE.Mesh(
      haloGeometry,
      new THREE.MeshBasicMaterial({
        color: ROUTE_HALO,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    ),
    new THREE.Mesh(
      coreGeometry,
      new THREE.MeshBasicMaterial({
        color: ROUTE_CORE,
        transparent: true,
        opacity: 0.92,
      }),
    ),
  ];

  await buildCameraPath(routePoints, climb);
  markBootPhase("route_and_camera", { duration_ms: performance.now() - routeStarted });
}

async function buildCameraPath(routePoints, climb) {
  if (routePoints.length < 2) {
    throw new Error(`Camera path requires at least 2 route points, got ${routePoints.length}.`);
  }

  const cachedCameraResponse = await loadDerivedCache("camera-path.json");
  if (cachedCameraResponse) {
    const cached = await cachedCameraResponse.json();
    if (cached.positions?.length && cached.lookTargets?.length) {
      cameraPositions = cached.positions.map(
        (coords) => new THREE.Vector3(coords[0], coords[1], coords[2]),
      );
      lookTargets = cached.lookTargets.map(
        (coords) => new THREE.Vector3(coords[0], coords[1], coords[2]),
      );
      return;
    }
  }

  const rawPositions = [];
  const rawLooks = [];
  const trackStartKm = segmentData.track[0].km;
  const trackEndKm = segmentData.track.at(-1).km;
  const pointCount = routePoints.length;

  for (let index = 0; index < pointCount; index += 1) {
    const routeT = pointCount <= 1 ? 0 : index / (pointCount - 1);
    const point = routePoints[index];
    if (!point) {
      continue;
    }
    const prev = routePoints[Math.max(0, index - 6)] ?? point;
    const next = routePoints[Math.min(pointCount - 1, index + 6)] ?? point;
    const tangent = next.clone().sub(prev);
    if (tangent.lengthSq() < 1e-4) {
      tangent.set(0, 0, 1);
    } else {
      tangent.normalize();
    }
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const km = lerp(trackStartKm, trackEndKm, routeT);
    const framing = documentaryFraming(routeT, km, climb);

    const lateralPoint = point.clone().add(right.clone().multiplyScalar(framing.lateral));
    const groundY = heightSampler(lateralPoint.x, lateralPoint.z);
    const position = new THREE.Vector3(lateralPoint.x, groundY + framing.altitudeAgl, lateralPoint.z);

    const lookIndex = Math.min(
      pointCount - 1,
      Math.max(0, index + Math.round(framing.lookAheadSteps)),
    );
    const lookRoutePoint = routePoints[lookIndex] ?? point;
    const lookGroundY = heightSampler(lookRoutePoint.x, lookRoutePoint.z);
    const lookTarget = new THREE.Vector3(
      lookRoutePoint.x,
      lookGroundY + 28,
      lookRoutePoint.z,
    );

    rawPositions.push(position);
    rawLooks.push(lookTarget);
  }

  const positionCurve = new THREE.CatmullRomCurve3(rawPositions, false, "catmullrom", 0.05);
  const lookCurve = new THREE.CatmullRomCurve3(rawLooks, false, "catmullrom", 0.05);
  const smoothPositions = positionCurve.getSpacedPoints(2400);
  const smoothLooks = lookCurve.getSpacedPoints(2400);

  cameraPositions = smoothPositions
    .filter((point) => point)
    .map((point) => {
      const groundY = heightSampler(point.x, point.z);
      return new THREE.Vector3(point.x, Math.max(point.y, groundY + 120), point.z);
    });
  lookTargets = smoothLooks
    .filter((point) => point)
    .map((point) => {
      const groundY = heightSampler(point.x, point.z);
      return new THREE.Vector3(point.x, groundY + 24, point.z);
    });

  saveDerivedCache(
    "camera-path.json",
    JSON.stringify({
      positions: cameraPositions.map((point) => [point.x, point.y, point.z]),
      lookTargets: lookTargets.map((point) => [point.x, point.y, point.z]),
    }),
  );
}

function remapTimeline(t) {
  if (t < 0.24) {
    return smootherstep(0, 0.24, t) * 0.06;
  }
  if (t < 0.8) {
    const local = (t - 0.24) / 0.56;
    return lerp(0.06, 0.93, smootherstep(0, 1, local));
  }
  const local = (t - 0.8) / 0.2;
  return lerp(0.93, 1, smootherstep(0, 1, local));
}

function routeProgressAtTime(timeS) {
  const t = remapTimeline(clamp(timeS / DURATION_S, 0, 1));
  const trackStartKm = segmentData.track[0].km;
  const trackEndKm = segmentData.track.at(-1).km;
  const km = lerp(trackStartKm, trackEndKm, t);
  const climb = segmentData.climb;
  const inClimb = km >= climb.start_km && km <= climb.end_km;
  const climbT = inClimb ? clamp((km - climb.start_km) / (climb.end_km - climb.start_km), 0, 1) : 0;
  return { t, km, inClimb, climbT };
}

function sampleCamera(timeS) {
  const progress = routeProgressAtTime(timeS);
  const floatIndex = progress.t * (cameraPositions.length - 1);
  const left = Math.floor(floatIndex);
  const right = Math.min(cameraPositions.length - 1, left + 1);
  const blend = smootherstep(0, 1, floatIndex - left);

  const position = cameraPositions[left].clone().lerp(cameraPositions[right], blend);
  const lookAt = lookTargets[left].clone().lerp(lookTargets[right], blend);

  const groundY = heightSampler(position.x, position.z);
  position.y = Math.max(position.y, groundY + 120);

  return { position, lookAt, progress };
}

function initScene() {
  const host = document.getElementById("canvas-host");
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8aa3bc);
  scene.fog = new THREE.FogExp2(0xc2d4e4, 0.000012);

  camera = new THREE.PerspectiveCamera(54, RENDER_WIDTH / RENDER_HEIGHT, 2, 180_000);

  const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x3d3830, 0.62);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3e0, 1.18);
  sun.position.set(-2200, 3600, 1400);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.28);
  fill.position.set(1800, 1200, -900);
  scene.add(fill);
}

function climbStripMetrics(timeS, progress) {
  const { km, inClimb } = progress;
  const climb = segmentData.climb;
  const opacity = climbStripOpacity(timeS, km, climb);
  if (opacity <= 0.01 || !climbProfile) {
    return { opacity, visible: false };
  }

  const distIntoKm = clamp(km - climb.start_km, 0, climb.length_km);
  const distRemainingKm = clamp(climb.end_km - km, 0, climb.length_km);
  const current = interpolateTrack(km);
  const gained = Math.max(0, current.ele_m - climbProfile.startEle);
  const remaining = Math.max(0, climbProfile.endEle - current.ele_m);
  const gradient = gradientLast100m(km);
  const markerT = clamp(distIntoKm / climb.length_km, 0, 1);
  const markerX = climbProfile.padding + markerT * (climbProfile.width - climbProfile.padding * 2);
  const markerY =
    climbProfile.height -
    climbProfile.padding -
    ((current.ele_m - climbProfile.minEle) / climbProfile.span) *
      (climbProfile.height - climbProfile.padding * 2);

  return {
    opacity,
    visible: true,
    distIntoKm,
    distRemainingKm,
    gained,
    remaining,
    altitude: current.ele_m,
    altitudeSub: inClimb ? climb.name : "Approaching climb",
    gradient,
    markerX,
    markerY,
  };
}

function initCaptureCanvas() {
  compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = RENDER_WIDTH;
  compositeCanvas.height = RENDER_HEIGHT;
  compositeCtx = compositeCanvas.getContext("2d", { alpha: false });
}

function drawVignette2D(ctx) {
  const gradient = ctx.createRadialGradient(
    RENDER_WIDTH / 2,
    RENDER_HEIGHT / 2,
    RENDER_WIDTH * 0.26,
    RENDER_WIDTH / 2,
    RENDER_HEIGHT / 2,
    RENDER_WIDTH * 0.72,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawOverlay2D(ctx, timeS) {
  const opacity = overlayOpacity(timeS);
  if (opacity <= 0.01) {
    return;
  }

  const overlay = segmentData.overlay;
  const x = 128;
  const width = 680;
  const translateY = lerp(22, 0, opacity);
  const height = 420;
  const y = RENDER_HEIGHT - 220 - height + translateY;

  ctx.save();
  ctx.globalAlpha = opacity;
  drawRoundedRect(ctx, x, y, width, height, 22);
  ctx.fillStyle = "rgba(8, 8, 10, 0.22)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
  ctx.font = "500 14px Inter, system-ui, sans-serif";
  ctx.fillText(overlay.title.toUpperCase(), x + 40, y + 52);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 68px Inter, system-ui, sans-serif";
  ctx.fillText(overlay.name, x + 40, y + 132);

  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.font = "400 34px Inter, system-ui, sans-serif";
  let statsY = y + 188;
  for (const line of overlay.stats_lines) {
    ctx.fillText(line, x + 40, statsY);
    statsY += 38;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  ctx.font = "500 13px Inter, system-ui, sans-serif";
  ctx.fillText("LAST VERIFIED WATER", x + 40, statsY + 18);

  const water = overlay.last_verified_water;
  const waterText = water ? `${water.poi_name}, km ${water.km}` : "None verified before this climb";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = "400 26px Inter, system-ui, sans-serif";
  ctx.fillText(waterText, x + 40, statsY + 52);
  ctx.restore();
}

function drawClimbStrip2D(ctx, timeS, progress) {
  const metrics = climbStripMetrics(timeS, progress);
  if (!metrics.visible) {
    return;
  }

  const stripWidth = Math.min(1180, RENDER_WIDTH - 256);
  const x = (RENDER_WIDTH - stripWidth) / 2;
  const height = 170;
  const translateY = lerp(12, 0, metrics.opacity);
  const y = RENDER_HEIGHT - 72 - height + translateY;

  ctx.save();
  ctx.globalAlpha = metrics.opacity;
  drawRoundedRect(ctx, x, y, stripWidth, height, 18);
  ctx.fillStyle = "rgba(8, 8, 10, 0.18)";
  ctx.fill();

  const metricsY = y + 34;
  const columns = [
    {
      label: "DISTANCE",
      value: `${metrics.distIntoKm.toFixed(1)} km in`,
      sub: `${metrics.distRemainingKm.toFixed(1)} km remaining`,
      x: x + 28,
    },
    {
      label: "ELEVATION",
      value: `+${Math.round(metrics.gained)} m`,
      sub: `+${Math.round(metrics.remaining)} m to go`,
      x: x + 28 + stripWidth * 0.24,
    },
    {
      label: "ALTITUDE",
      value: formatMeters(metrics.altitude),
      sub: metrics.altitudeSub,
      x: x + 28 + stripWidth * 0.48,
    },
    {
      label: "GRADIENT",
      value: formatGradient(metrics.gradient),
      sub: "last 100 m",
      x: x + 28 + stripWidth * 0.72,
    },
  ];

  for (const column of columns) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.52)";
    ctx.font = "500 11px Inter, system-ui, sans-serif";
    ctx.fillText(column.label, column.x, metricsY);
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.font = "500 22px Inter, system-ui, sans-serif";
    ctx.fillText(column.value, column.x, metricsY + 28);
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.font = "400 14px Inter, system-ui, sans-serif";
    ctx.fillText(column.sub, column.x, metricsY + 48);
  }

  if (climbProfile) {
    const profileX = x + 28;
    const profileY = y + 98;
    const profileWidth = stripWidth - 56;
    const profileHeight = 54;
    const scaleX = profileWidth / climbProfile.width;
    const scaleY = profileHeight / climbProfile.height;

    ctx.save();
    ctx.translate(profileX, profileY);
    ctx.scale(scaleX, scaleY);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 48);
    ctx.lineTo(1124, 48);
    ctx.stroke();

    if (climbProfile.coords.length > 1) {
      ctx.beginPath();
      climbProfile.coords.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.lineTo(climbProfile.coords.at(-1).x, climbProfile.height - climbProfile.padding);
      ctx.lineTo(climbProfile.coords[0].x, climbProfile.height - climbProfile.padding);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(metrics.markerX, metrics.markerY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function compositeCapturedFrame(timeS, progress) {
  compositeCtx.drawImage(renderer.domElement, 0, 0, RENDER_WIDTH, RENDER_HEIGHT);
  drawVignette2D(compositeCtx);
  drawOverlay2D(compositeCtx, timeS);
  drawClimbStrip2D(compositeCtx, timeS, progress);
}

function renderFrame(frameIndex) {
  const frameStarted = performance.now();
  const timeS = frameIndex / FPS;
  const cameraStarted = performance.now();
  const { position, lookAt, progress } = sampleCamera(timeS);
  camera.position.copy(position);
  camera.lookAt(lookAt);
  const cameraMs = performance.now() - cameraStarted;
  const overlayStarted = performance.now();
  if (!captureMode) {
    updateOverlay(timeS);
    updateClimbStrip(timeS, progress);
  }
  const overlayMs = performance.now() - overlayStarted;
  const renderStarted = performance.now();
  renderer.render(scene, camera);
  const renderMs = performance.now() - renderStarted;
  if (profileMode) {
    window.__lastFrameTimings = {
      camera_ms: cameraMs,
      overlay_ms: overlayMs,
      webgl_render_ms: renderMs,
      total_ms: performance.now() - frameStarted,
    };
  }
}

async function captureFrameJpeg(frameIndex) {
  return captureFrameImage(frameIndex, "jpeg");
}

async function captureFrameImage(frameIndex, format = "jpeg") {
  const captureStarted = performance.now();
  const timeS = frameIndex / FPS;
  const { position, lookAt, progress } = sampleCamera(timeS);
  camera.position.copy(position);
  camera.lookAt(lookAt);
  renderer.render(scene, camera);
  compositeCapturedFrame(timeS, progress);

  const mime = format === "png" ? "image/png" : "image/jpeg";
  const dataUrl =
    format === "png"
      ? compositeCanvas.toDataURL(mime)
      : compositeCanvas.toDataURL(mime, jpegQuality);
  const imageBase64 = dataUrl.split(",")[1];
  const compositeMs = performance.now() - captureStarted;

  if (profileMode) {
    window.__lastFrameTimings = {
      camera_ms: 0,
      overlay_ms: 0,
      webgl_render_ms: 0,
      canvas_capture_ms: compositeMs,
      total_ms: compositeMs,
    };
  }

  return imageBase64;
}

async function boot() {
  const segmentUrl = urlParams.get("segment") || "./segment/capitals-hardest-climb.json";
  setBootPhase("segment", "Loading route segment…");
  const segmentStarted = performance.now();
  segmentData = await (await fetch(segmentUrl)).json();
  totalFrames = FPS * DURATION_S;
  populateOverlay(segmentData);
  markBootPhase("segment", { duration_ms: performance.now() - segmentStarted });

  setBootPhase("profile", "Building climb profile…");
  const profileStarted = performance.now();
  climbProfile = buildClimbProfile(segmentData.track, segmentData.climb);
  markBootPhase("profile", { duration_ms: performance.now() - profileStarted });

  setBootPhase("scene", "Initialising renderer…");
  const sceneStarted = performance.now();
  initScene();
  if (captureMode) {
    overlayEl.hidden = true;
    climbStripEl.hidden = true;
    document.getElementById("vignette").style.display = "none";
    initCaptureCanvas();
    await document.fonts.ready;
  }
  markBootPhase("scene", { duration_ms: performance.now() - sceneStarted });

  setBootPhase("terrain", "Loading high-resolution terrain…");
  const terrainStarted = performance.now();
  const { originLat, originLon } = await buildTerrain(segmentData.track);
  markBootPhase("terrain", { duration_ms: performance.now() - terrainStarted });
  scene.add(terrainMesh);

  setBootPhase("route", "Building route geometry…");
  await buildRouteMeshes(segmentData.track, originLon, originLat, segmentData.climb);
  for (const mesh of routeMeshes) {
    scene.add(mesh);
  }

  setBootPhase("ready", "Ready");
  window.__pocBootTimings.total_ms = performance.now() - window.__pocBootTimings.started_at;
  loadingEl.style.display = "none";
  window.__pocReady = true;
  window.__renderFrame = renderFrame;
  window.__captureFrameJpeg = captureFrameJpeg;
  window.__captureFrameImage = captureFrameImage;
  window.__totalFrames = totalFrames;
  window.__fps = FPS;
  renderFrame(0);
}

boot().catch((error) => {
  window.__pocBootError = error.stack || error.message;
  loadingEl.textContent = `Failed: ${error.message}`;
  console.error(error);
});
