import * as THREE from "three";
import {
  sceneById,
  sceneTerrainTrack,
  sceneTerrainZoom,
} from "../core/routeTrack";
import { sceneIndexAtTime } from "../core/timeline";
import type { RoutePreviewRuntime } from "../core/types";
import { RoutePreviewCameraPath, SmoothedCamera } from "./camera";
import { buildRouteMeshes, buildTerrain, type TerrainBuildResult } from "./terrain";
import type { RoutePreviewVisualStyle } from "./visualStyles";
import { DEFAULT_VISUAL_STYLE } from "./visualStyles";

export interface RoutePreviewEngineOptions {
  host: HTMLElement;
  runtime: RoutePreviewRuntime;
  cacheBaseUrl?: string;
  visualStyle?: RoutePreviewVisualStyle;
  onBootProgress?: (message: string, progress?: { loaded: number; total: number }) => void;
  onSceneLoading?: (loading: boolean) => void;
}

interface SceneBundle {
  sceneId: string;
  terrain: TerrainBuildResult;
  routeMeshes: THREE.Mesh[];
  cameraPath: RoutePreviewCameraPath;
}

export class RoutePreviewEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private smoothedCamera = new SmoothedCamera();
  private disposed = false;
  private lastTimeS = 0;
  private lastRenderedTimeS = 0;
  private activeSceneId: string | null = null;
  private activeBundle: SceneBundle | null = null;
  private sceneBundles = new Map<string, SceneBundle>();
  private sceneLoadPromises = new Map<string, Promise<SceneBundle>>();
  private sceneSwitchInFlight: string | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private routeMeshes: THREE.Mesh[] = [];
  private visualStyle: RoutePreviewVisualStyle;

  constructor(private readonly options: RoutePreviewEngineOptions) {
    this.visualStyle = options.visualStyle ?? DEFAULT_VISUAL_STYLE;
  }

  async boot(): Promise<void> {
    const { host, runtime, onBootProgress } = this.options;

    onBootProgress?.("Initialising renderer…");
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.pointerEvents = "none";
    host.replaceChildren(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd8e4ec);
    this.scene.fog = new THREE.FogExp2(0xdce6ee, 0.000003);

    this.camera = new THREE.PerspectiveCamera(
      48,
      host.clientWidth / Math.max(1, host.clientHeight),
      2,
      180_000,
    );

    this.scene.add(new THREE.HemisphereLight(0xf5f8fc, 0xb8c4a8, 0.85));
    const sun = new THREE.DirectionalLight(0xfff8ee, 0.55);
    sun.position.set(-1800, 3200, 1200);
    this.scene.add(sun);

    const firstSceneId = runtime.timeline[0]?.sceneId;
    if (!firstSceneId) {
      throw new Error("Route preview runtime has no timeline scenes.");
    }

    onBootProgress?.("Loading opening scene…");
    await this.activateScene(firstSceneId, true);
    void this.preloadRemainingScenes(firstSceneId);
    onBootProgress?.("Ready");
  }

  resize(width: number, height: number): void {
    if (!this.renderer || !this.camera) {
      return;
    }
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(timeS: number): void {
    if (!this.renderer || !this.scene || !this.camera || this.disposed) {
      return;
    }

    this.lastTimeS = timeS;
    const sceneId = this.sceneIdAtTime(timeS);
    if (
      sceneId &&
      sceneId !== this.activeSceneId &&
      sceneId !== this.sceneSwitchInFlight
    ) {
      this.sceneSwitchInFlight = sceneId;
      void this.activateScene(sceneId, false).finally(() => {
        if (this.sceneSwitchInFlight === sceneId) {
          this.sceneSwitchInFlight = null;
        }
        if (!this.disposed) {
          this.render(this.lastTimeS);
        }
      });
    }

    const cameraPath = this.activeBundle?.cameraPath;
    if (!cameraPath || (sceneId && sceneId !== this.activeSceneId)) {
      return;
    }

    if (Math.abs(timeS - this.lastRenderedTimeS) > 0.75) {
      this.smoothedCamera.reset(cameraPath.sample(timeS));
    }

    const sample = this.smoothedCamera.update(cameraPath.sample(timeS), timeS);
    this.camera.position.copy(sample.position);
    this.camera.lookAt(sample.lookAt);
    this.renderer.render(this.scene, this.camera);
    this.lastRenderedTimeS = timeS;
  }

  dispose(): void {
    this.disposed = true;
    this.disposeActiveMeshes();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.activeBundle = null;
    this.sceneBundles.clear();
    this.sceneLoadPromises.clear();
  }

  async setVisualStyle(style: RoutePreviewVisualStyle): Promise<void> {
    if (this.visualStyle === style || this.disposed) {
      return;
    }
    this.visualStyle = style;
    this.sceneBundles.clear();
    this.sceneLoadPromises.clear();
    const sceneId = this.activeSceneId ?? this.options.runtime.timeline[0]?.sceneId;
    if (sceneId) {
      await this.activateScene(sceneId, false);
    }
  }

  private disposeActiveMeshes(): void {
    if (this.terrainMesh && this.scene) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      const material = this.terrainMesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
      this.terrainMesh = null;
    }
    for (const mesh of this.routeMeshes) {
      this.scene?.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.routeMeshes = [];
  }

  private sceneIdAtTime(timeS: number): string | null {
    const index = sceneIndexAtTime(this.options.runtime.timeline, timeS);
    return this.options.runtime.timeline[index]?.sceneId ?? null;
  }

  private async preloadRemainingScenes(skipSceneId: string): Promise<void> {
    for (const entry of this.options.runtime.timeline) {
      if (entry.sceneId === skipSceneId || this.sceneBundles.has(entry.sceneId)) {
        continue;
      }
      try {
        await this.loadSceneBundle(entry.sceneId);
      } catch {
        // Scene preload failures are non-fatal; activateScene will retry.
      }
    }
  }

  private async loadSceneBundle(sceneId: string): Promise<SceneBundle> {
    const cached = this.sceneBundles.get(sceneId);
    if (cached) {
      return cached;
    }

    const inflight = this.sceneLoadPromises.get(sceneId);
    if (inflight) {
      return inflight;
    }

    const promise = this.buildSceneBundle(sceneId);
    this.sceneLoadPromises.set(sceneId, promise);
    try {
      const bundle = await promise;
      this.sceneBundles.set(sceneId, bundle);
      return bundle;
    } finally {
      this.sceneLoadPromises.delete(sceneId);
    }
  }

  private async buildSceneBundle(sceneId: string): Promise<SceneBundle> {
    const { runtime, cacheBaseUrl, onBootProgress } = this.options;
    const scene = sceneById(runtime, sceneId);
    if (!scene) {
      throw new Error(`Unknown scene ${sceneId}`);
    }

    const track = sceneTerrainTrack(runtime, scene);
    const terrainZoom = sceneTerrainZoom(scene.type);
    const terrain = await buildTerrain({
      track,
      terrainSegments: Math.max(runtime.settings.draft.terrainSegments, 400),
      terrainZoom,
      cacheBaseUrl,
      visualStyle: this.visualStyle,
      onProgress: (loaded, total) => {
        onBootProgress?.(`Loading ${scene.title} terrain ${loaded}/${total}…`, { loaded, total });
      },
    });

    const routeMeshes = buildRouteMeshes(
      track,
      terrain.originLon,
      terrain.originLat,
      terrain.heightSampler,
      runtime.settings.draft.routeTubeSegments,
      this.visualStyle,
    );

    const cameraPath = new RoutePreviewCameraPath(
      runtime,
      terrain.heightSampler,
      terrain.originLon,
      terrain.originLat,
    );

    return { sceneId, terrain, routeMeshes, cameraPath };
  }

  private async activateScene(sceneId: string, isBoot: boolean): Promise<void> {
    if (this.disposed || !this.scene) {
      return;
    }

    if (this.activeSceneId === sceneId && this.activeBundle) {
      return;
    }

    const { onSceneLoading } = this.options;
    if (!isBoot) {
      onSceneLoading?.(true);
    }

    try {
      const bundle = await this.loadSceneBundle(sceneId);
      if (this.disposed || !this.scene) {
        return;
      }

      if (this.terrainMesh) {
        this.disposeActiveMeshes();
      }

      this.terrainMesh = bundle.terrain.mesh;
      this.scene.add(bundle.terrain.mesh);
      for (const mesh of bundle.routeMeshes) {
        this.scene.add(mesh);
        this.routeMeshes.push(mesh);
      }

      this.activeSceneId = sceneId;
      this.activeBundle = bundle;
      this.smoothedCamera.reset(bundle.cameraPath.sample(this.lastTimeS));
    } catch (error) {
      console.error(`Failed to load route preview scene ${sceneId}`, error);
    } finally {
      if (!isBoot) {
        onSceneLoading?.(false);
      }
    }
  }
}
