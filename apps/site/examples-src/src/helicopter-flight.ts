/**
 * Helicopter Flight Simulation
 *
 * Helicopter flying across Turkey (Kars -> Edirne).
 * Demonstrates: 3D model animation, Clock, SampledProperty, GraphicsLayer,
 * timeline controls, vertical curtain visualization.
 *
 * --- PARAMETRIC ROUTE ---
 * Edit WAYPOINTS below to change the flight path.
 * Each waypoint: { lon, lat, alt } where alt is meters above ground.
 */

import { MapView, JulianDate, Clock, SampledProperty, CallbackRenderer, SimpleRenderer, createCircleGeometry, createFrustumGeo, pointInFrustum, aabbInFrustum } from '@mapgpu/core';
import type { CameraLockTarget, ModelMetadata, ModelSymbol, Feature, SymbolRenderContext, ExtrudedPolygonSymbol, FrustumGeoResult, GlobeEffectsConfig } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer, WallLayer } from '@mapgpu/layers';
import { DTEDLayer } from '@mapgpu/terrain';
import { haversineDistance, destinationPoint, interpolateGreatCircle } from '@mapgpu/analysis';
import { makeRectFootprint, DrawPolylineTool } from '@mapgpu/tools';

// ═══════════════════════════════════════════════════════════════
//  PARAMETRIC ROUTE — Edit these waypoints to change the flight
// ═══════════════════════════════════════════════════════════════

const DEFAULT_WAYPOINTS = [
  { lon: 43.10, lat: 40.60, alt:  800 },  // Kars
  { lon: 41.27, lat: 41.00, alt: 1200 },  // Trabzon
  { lon: 39.90, lat: 40.50, alt:  600 },  // Near Erzurum
  { lon: 36.33, lat: 41.30, alt: 1400 },  // Samsun
  { lon: 33.80, lat: 40.60, alt:  900 },  // Cankiri
  { lon: 32.86, lat: 39.93, alt: 1000 },  // Ankara
  { lon: 30.30, lat: 40.20, alt:  700 },  // Eskisehir
  { lon: 29.40, lat: 40.50, alt: 1100 },  // Bursa
  { lon: 29.00, lat: 41.01, alt: 1500 },  // Istanbul
  { lon: 27.00, lat: 41.10, alt:  900 },  // Kirklareli
  { lon: 26.56, lat: 41.68, alt:  500 },  // Edirne
];

const DEFAULT_CRUISE_ALT = 800;            // Default altitude for drawn routes (metres)
const TAKEOFF_DURATION_SECONDS = 10;       // First 10s: climb from ground to cruise alt

let WAYPOINTS = [...DEFAULT_WAYPOINTS];

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const MODEL_ID = 'sikorsky';
let modelHeadingOffset = 0;                  // Auto-detected from model bounds after load
const DEFAULT_MODEL_SCALE = 50;
const MODEL_SCALE_REFERENCE_ZOOM = 10;
const MAX_AUTO_SCALE = 2000;
let modelScale = DEFAULT_MODEL_SCALE;
let modelYaw = -38;
let modelPitch = 0;
let modelRoll = 0;
const FLIGHT_DURATION_SECONDS = 3600;       // 1 hour sim-time
const SPEED_OPTIONS = [1, 2, 5, 10];        // Clock multiplier options
const SAMPLE_INTERVAL_SECONDS = 15;         // Trail sampling interval
const CURTAIN_STEP = 5;                     // Dropper line every N trail points
const FOLLOW_CAMERA_ZOOM = 11;
const FOLLOW_CAMERA_PITCH = 58;
const FOLLOW_CAMERA_CENTER_HALF_LIFE_MS = 180;
let modelMetadata: ModelMetadata | null = null;

const HELI_GLOBE_EFFECTS = {
  backgroundColor: [0.42, 0.64, 0.96, 1.0],
  lighting: {
    sunAltitude: 34,
    sunAzimuth: 132,
  },
  sky: {
    preset: 'realistic-cinematic',
  },
} satisfies GlobeEffectsConfig;

// ─── Collision Configuration ───
let WARNING_RADIUS_M = 15_000;
let DANGER_RADIUS_M = 5_000;
let obstacleCount = 800;
const OBSTACLE_HEIGHT_MIN = 300;
const OBSTACLE_HEIGHT_MAX = 2000;
const OBSTACLE_WIDTH_MIN = 80;
const OBSTACLE_WIDTH_MAX = 200;
const LATERAL_SPREAD_M = 4000; // ±2km from route centerline
const DEG_TO_RAD = Math.PI / 180;

// ─── Frustum Configuration ───
const FRUSTUM_FOV_H = 30;        // horizontal FOV degrees
const FRUSTUM_FOV_V = 20;        // vertical FOV degrees
const FRUSTUM_NEAR = 200;        // near plane metres
const FRUSTUM_FAR = 8_000;       // far plane metres (8km)

// ─── Collision Types ───
type CollisionState = 'safe' | 'warning' | 'danger' | 'frustum';

interface ObstacleData {
  id: string;
  lon: number;
  lat: number;
  halfWidth: number;   // half-width in metres (footprint)
  height: number;      // extrusion height in metres
  footprint: number[][]; // closed polygon ring from makeRectFootprint
  collisionState: CollisionState;
  prevState: CollisionState;
  everHit: boolean;
}

// ─── Collision State ───
let obstacleSeed = 42;
let obstacles: ObstacleData[] = [];
let totalHits = 0;
let obstaclesVisible = true;


// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════

/** Geodetic forward azimuth (bearing) between two points in degrees. */
function computeBearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = Math.PI / 180;
  const dLon = (lon2 - lon1) * toRad;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

/** Seeded PRNG (mulberry32) for deterministic obstacle placement. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate obstacle data along the flight route. */
function generateObstacles(count: number, seed: number): ObstacleData[] {
  const rng = mulberry32(seed);
  const result: ObstacleData[] = [];

  // Sample points along the route at ~4km intervals
  const samplePoints: { lon: number; lat: number; bearingRad: number }[] = [];
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const wp1 = WAYPOINTS[i]!;
    const wp2 = WAYPOINTS[i + 1]!;
    const segDistM = haversineDistance(wp1.lon, wp1.lat, wp2.lon, wp2.lat);
    const steps = Math.max(1, Math.floor(segDistM / 4000));
    const bearingRad = computeBearing(wp1.lon, wp1.lat, wp2.lon, wp2.lat) * DEG_TO_RAD;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const [lon, lat] = interpolateGreatCircle(wp1.lon, wp1.lat, wp2.lon, wp2.lat, t);
      samplePoints.push({ lon, lat, bearingRad });
    }
  }

  if (samplePoints.length === 0) return result;

  // Distribute obstacles from sample points (round-robin)
  let idx = 0;
  while (result.length < count) {
    const sp = samplePoints[idx % samplePoints.length]!;
    idx++;

    // 20% near-track (< 500m), 80% lateral spread (±2km)
    const nearTrack = rng() < 0.2;
    const lateralOffset = nearTrack
      ? (rng() - 0.5) * 1000    // ±500m
      : (rng() - 0.5) * 2 * LATERAL_SPREAD_M;  // ±4km

    const perpBearing = sp.bearingRad + Math.PI / 2;
    const [obsLon, obsLat] = destinationPoint(sp.lon, sp.lat, perpBearing, lateralOffset);

    const height = OBSTACLE_HEIGHT_MIN + rng() * (OBSTACLE_HEIGHT_MAX - OBSTACLE_HEIGHT_MIN);
    const halfWidth = (OBSTACLE_WIDTH_MIN + rng() * (OBSTACLE_WIDTH_MAX - OBSTACLE_WIDTH_MIN)) / 2;
    const footprint = makeRectFootprint(obsLon, obsLat, halfWidth, halfWidth);

    result.push({
      id: `obs-${result.length}`,
      lon: obsLon,
      lat: obsLat,
      halfWidth,
      height,
      footprint,
      collisionState: 'safe',
      prevState: 'safe',
      everHit: false,
    });
  }

  return result;
}

/** Format seconds as MM:SS. */
function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.floor(Math.abs(seconds) % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
//  MAP SETUP
// ═══════════════════════════════════════════════════════════════

const container3d = document.getElementById('map-container-3d')!;
const container2d = document.getElementById('map-container-2d')!;
const engine3d = new RenderEngine();
const engine2d = new RenderEngine();

// Center of Turkey
const centerLon = WAYPOINTS.reduce((s, w) => s + w.lon, 0) / WAYPOINTS.length;
const centerLat = WAYPOINTS.reduce((s, w) => s + w.lat, 0) / WAYPOINTS.length;

const view3d = new MapView({
  mode: '3d',
  container: container3d,
  center: [centerLon, centerLat],
  zoom: 5,
  pitch: 48,
  bearing: 0,
  renderEngine: engine3d,
  globeEffects: HELI_GLOBE_EFFECTS,
});

const view2d = new MapView({
  mode: '2d',
  container: container2d,
  center: [centerLon, centerLat],
  zoom: 5,
  renderEngine: engine2d,
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view3d.mode === "2d" ? "3d" : "2d";
  await view3d.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view3d.mode === "2d" ? "3D" : "2D"}`;
});

// ═══════════════════════════════════════════════════════════════
//  TEMPORAL SETUP — Clock & SampledProperty
// ═══════════════════════════════════════════════════════════════

const start = JulianDate.fromIso8601('2024-06-15T06:00:00Z');
const stop = start.addSeconds(FLIGHT_DURATION_SECONDS);

const clock = new Clock({
  startTime: start,
  stopTime: stop,
  currentTime: start.clone(),
  multiplier: SPEED_OPTIONS[0],
  clockRange: 'LOOP_STOP',
});

// Build sampled position property: distribute waypoints evenly across flight duration
let positionProp = new SampledProperty(3, 'linear');
let totalDist = 0;

/**
 * Rebuild the position property from current WAYPOINTS.
 * Injects a takeoff phase: first TAKEOFF_DURATION_SECONDS the heli climbs from
 * ground level at wp[0] to wp[0].alt while staying at the first position.
 */
function rebuildPositionProp(): void {
  positionProp = new SampledProperty(3, 'linear');

  if (WAYPOINTS.length === 0) return;

  // Takeoff: t=0 at ground, t=TAKEOFF at cruise alt (same lon/lat as wp[0])
  const wp0 = WAYPOINTS[0]!;
  positionProp.addSample(start, [wp0.lon, wp0.lat, 0]);
  positionProp.addSample(start.addSeconds(TAKEOFF_DURATION_SECONDS), [wp0.lon, wp0.lat, wp0.alt]);

  // Remaining flight time after takeoff
  const flightTime = FLIGHT_DURATION_SECONDS - TAKEOFF_DURATION_SECONDS;

  // Cumulative distances for proportional time distribution
  const distances: number[] = [0];
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const prev = WAYPOINTS[i - 1]!;
    const curr = WAYPOINTS[i]!;
    distances.push(distances[i - 1]! + haversineDistance(prev.lon, prev.lat, curr.lon, curr.lat) / 1000);
  }
  totalDist = distances[distances.length - 1]!;

  // Distribute waypoints across remaining flight time (after takeoff)
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const wp = WAYPOINTS[i]!;
    const ratio = totalDist > 0 ? distances[i]! / totalDist : i / (WAYPOINTS.length - 1);
    const t = start.addSeconds(TAKEOFF_DURATION_SECONDS + ratio * flightTime);
    positionProp.addSample(t, [wp.lon, wp.lat, wp.alt]);
  }
}

rebuildPositionProp();

// ═══════════════════════════════════════════════════════════════
//  LAYERS
// ═══════════════════════════════════════════════════════════════

// 1. Route preview (full planned route, faint dashed line)
const routePreviewLayer = new GraphicsLayer({ id: 'route-preview' });
routePreviewLayer.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [255, 255, 255, 50],
  width: 2,
  style: 'dash',
} as never);

// 2. Ground shadow trail
const groundTrailLayer = new GraphicsLayer({ id: 'ground-trail' });
groundTrailLayer.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [255, 109, 58, 40],
  width: 3,
  style: 'solid',
} as never);

// 3. Wall curtain (filled wall from altitude to ground)
const wallLayer = new WallLayer({
  id: 'curtain',
  fillColor: [50, 120, 220, 80],
  outlineColor: [30, 90, 200, 180],
  outlineWidth: 1,
});

// 4. Flight altitude trail
const trailLayer = new GraphicsLayer({ id: 'trail' });
trailLayer.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [255, 109, 58, 200],
  width: 3,
  style: 'solid',
} as never);

// 5. Helicopter model layer
const heliLayer = new GraphicsLayer({ id: 'helicopter' });

// 7. Collision obstacle layer (3D extruded boxes)
const obstacleLayer = new GraphicsLayer({ id: 'obstacles' });
obstacleLayer.renderer = new CallbackRenderer((feature: Feature) => {
  const state = feature.attributes.collisionState as CollisionState;
  const color: [number, number, number, number] =
    state === 'frustum' ? [0, 180, 255, 240] :
    state === 'danger'  ? [255, 40, 40, 240] :
    state === 'warning' ? [255, 200, 0, 220] :
                          [60, 200, 80, 200];
  return {
    type: 'fill-extrusion',
    color,
    heightField: 'height',
    minHeightField: 'minHeight',
    ambient: 0.35,
    shininess: 32,
    specularStrength: 0.15,
  } satisfies ExtrudedPolygonSymbol;
});

// 8. Warning circle (outer yellow ring)
const warningCircleLayer = new GraphicsLayer({ id: 'warning-circle' });
warningCircleLayer.renderer = new SimpleRenderer({
  type: 'simple-fill',
  color: [255, 200, 0, 30],
  outlineColor: [255, 200, 0, 150],
  outlineWidth: 2,
} as never);

// 9. Danger circle (inner red ring)
const dangerCircleLayer = new GraphicsLayer({ id: 'danger-circle' });
dangerCircleLayer.renderer = new SimpleRenderer({
  type: 'simple-fill',
  color: [255, 40, 40, 40],
  outlineColor: [255, 40, 40, 200],
  outlineWidth: 2,
} as never);

// 10. Frustum wireframe (view cone)
const frustumLayer = new GraphicsLayer({ id: 'frustum-wireframe' });
frustumLayer.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [0, 200, 255, 200],
  width: 2,
  style: 'solid',
} as never);

// ─── 2D Layer Duplicates ───

const routePreviewLayer2d = new GraphicsLayer({ id: '2d-route-preview' });
routePreviewLayer2d.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [255, 255, 255, 50],
  width: 2,
  style: 'dash',
} as never);

const groundTrailLayer2d = new GraphicsLayer({ id: '2d-ground-trail' });
groundTrailLayer2d.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [255, 109, 58, 40],
  width: 3,
  style: 'solid',
} as never);

const trailLayer2d = new GraphicsLayer({ id: '2d-trail' });
trailLayer2d.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [255, 109, 58, 200],
  width: 3,
  style: 'solid',
} as never);

const heliLayer2d = new GraphicsLayer({ id: '2d-helicopter' });

const obstacleLayer2d = new GraphicsLayer({ id: '2d-obstacles' });
obstacleLayer2d.renderer = new CallbackRenderer((feature: Feature) => {
  const state = feature.attributes.collisionState as CollisionState;
  const color: [number, number, number, number] =
    state === 'frustum' ? [0, 180, 255, 180] :
    state === 'danger'  ? [255, 40, 40, 180] :
    state === 'warning' ? [255, 200, 0, 160] :
                          [60, 200, 80, 140];
  return {
    type: 'simple-fill',
    color,
    outlineColor: color,
    outlineWidth: 1,
  } as never;
});

const warningCircleLayer2d = new GraphicsLayer({ id: '2d-warning-circle' });
warningCircleLayer2d.renderer = new SimpleRenderer({
  type: 'simple-fill',
  color: [255, 200, 0, 30],
  outlineColor: [255, 200, 0, 150],
  outlineWidth: 2,
} as never);

const dangerCircleLayer2d = new GraphicsLayer({ id: '2d-danger-circle' });
dangerCircleLayer2d.renderer = new SimpleRenderer({
  type: 'simple-fill',
  color: [255, 40, 40, 40],
  outlineColor: [255, 40, 40, 200],
  outlineWidth: 2,
} as never);

const frustumLayer2d = new GraphicsLayer({ id: '2d-frustum-wireframe' });
frustumLayer2d.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [0, 200, 255, 200],
  width: 2,
  style: 'solid',
} as never);

// ═══════════════════════════════════════════════════════════════
//  ANIMATION STATE
// ═══════════════════════════════════════════════════════════════

const traversedCoords: [number, number, number][] = [];
let lastSampleTime: JulianDate | null = null;
let lastProgress = 0;
let isPlaying = false;
let followMode = false;
let speedIndex = 0;
const heliState = {
  lon: WAYPOINTS[0]!.lon,
  lat: WAYPOINTS[0]!.lat,
  alt: WAYPOINTS[0]!.alt,
  heading: 0,
};

function setHeliState(lon: number, lat: number, alt: number, heading: number): void {
  heliState.lon = lon;
  heliState.lat = lat;
  heliState.alt = alt;
  heliState.heading = heading;
}

function getFollowVisualTarget(): { center: [number, number]; altitude: number } {
  const resolved = resolveCurrentModelBounds();
  const corners = resolved?.cornersLonLatAlt;
  if (!corners || corners.length === 0) {
    return {
      center: [heliState.lon, heliState.lat],
      altitude: heliState.alt,
    };
  }

  let sumLon = 0;
  let sumLat = 0;
  let sumAlt = 0;
  for (const [lon, lat, alt] of corners) {
    sumLon += lon;
    sumLat += lat;
    sumAlt += alt;
  }
  const centroidScale = 1 / corners.length;
  return {
    center: [
      sumLon * centroidScale,
      sumLat * centroidScale,
    ],
    altitude: sumAlt * centroidScale,
  };
}

function getFollowLockTarget(): CameraLockTarget {
  const target = getFollowVisualTarget();
  return {
    center: target.center,
    altitude: target.altitude,
  };
}

async function syncFollowCamera(resetView = false): Promise<void> {
  if (resetView) {
    const target = getFollowVisualTarget();
    await view3d.goTo({
      center: target.center,
      bearing: heliState.heading,
      pitch: FOLLOW_CAMERA_PITCH,
      zoom: FOLLOW_CAMERA_ZOOM,
      duration: 0,
    });
    await view2d.goTo({
      center: [heliState.lon, heliState.lat] as [number, number],
      zoom: FOLLOW_CAMERA_ZOOM,
      duration: 0,
    });
  }

  if (followMode) {
    view3d.lockCamera({
      getTarget: getFollowLockTarget,
      fields: ['center'],
      smoothing: {
        centerHalfLifeMs: FOLLOW_CAMERA_CENTER_HALF_LIFE_MS,
      },
    });
    view2d.lockCamera({
      getTarget: () => ({
        center: [heliState.lon, heliState.lat] as [number, number],
      }),
      fields: ['center'],
      smoothing: {
        centerHalfLifeMs: FOLLOW_CAMERA_CENTER_HALF_LIFE_MS,
      },
    });
  } else {
    view3d.unlockCamera();
    view2d.unlockCamera();
  }
}

// ═══════════════════════════════════════════════════════════════
//  TRAIL REBUILD (for slider scrubbing)
// ═══════════════════════════════════════════════════════════════

function rebuildTrailToTime(targetTime: JulianDate): void {
  traversedCoords.length = 0;
  wallLayer.clear();
  lastSampleTime = null;

  const elapsed = targetTime.secondsDifference(start);
  const numSamples = Math.floor(elapsed / SAMPLE_INTERVAL_SECONDS);

  const positions: [number, number][] = [];
  const heights: number[] = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = start.addSeconds(i * SAMPLE_INTERVAL_SECONDS);
    const pos = positionProp.getValue(t);
    traversedCoords.push([pos[0]!, pos[1]!, pos[2]!]);
    positions.push([pos[0]!, pos[1]!]);
    heights.push(pos[2]!);
    lastSampleTime = t;
  }
  if (positions.length >= 2) {
    wallLayer.setPositions(positions, heights);
  }

  updateTrailLayers();
}

function updateTrailLayers(): void {
  if (traversedCoords.length >= 2) {
    const trailFeature = {
      id: 'trail',
      geometry: { type: 'LineString' as const, coordinates: [...traversedCoords] },
      attributes: {},
    };
    trailLayer.replaceAll([trailFeature]);
    trailLayer2d.replaceAll([trailFeature]);

    const groundCoords = traversedCoords.map(([lo, la]) => [lo, la, 0]);
    const groundFeature = {
      id: 'ground-trail',
      geometry: { type: 'LineString' as const, coordinates: groundCoords },
      attributes: {},
    };
    groundTrailLayer.replaceAll([groundFeature]);
    groundTrailLayer2d.replaceAll([groundFeature]);

  } else {
    trailLayer.clear();
    trailLayer2d.clear();
    groundTrailLayer.clear();
    groundTrailLayer2d.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
//  UI ELEMENTS
// ═══════════════════════════════════════════════════════════════

const playBtn = document.getElementById('btn-play')!;
const resetBtn = document.getElementById('btn-reset')!;
const speedBadge = document.getElementById('speed-badge')!;
const sliderEl = document.getElementById('timeline-slider') as HTMLInputElement;
const timeDisplay = document.getElementById('time-display')!;
const progressLabel = document.getElementById('progress-label')!;
const btnFollow = document.getElementById('btn-follow')!;

// Flight info overlay
const infoAlt = document.getElementById('info-alt')!;
const infoHdg = document.getElementById('info-hdg')!;

// Collision HUD elements
const collStatusBar = document.getElementById('collision-status-bar')!;
const collStatusEl = document.getElementById('coll-status')!;
const collNearestEl = document.getElementById('coll-nearest')!;
const collWarningEl = document.getElementById('coll-warning')!;
const collDangerEl = document.getElementById('coll-danger')!;
const collFrustumEl = document.getElementById('coll-frustum')!;
const collTotalHitsEl = document.getElementById('coll-total-hits')!;

// Collision toolbar elements
const obstacleCountSlider = document.getElementById('obstacle-count') as HTMLInputElement;
const obstacleCountVal = document.getElementById('obstacle-count-val')!;
const warningRadiusSlider = document.getElementById('warning-radius') as HTMLInputElement;
const dangerRadiusSlider = document.getElementById('danger-radius') as HTMLInputElement;
const warningRadiusVal = document.getElementById('warning-radius-val')!;
const dangerRadiusVal = document.getElementById('danger-radius-val')!;
const btnRegen = document.getElementById('btn-regen')!;
const btnToggleObs = document.getElementById('btn-toggle-obs')!;
const infoSpd = document.getElementById('info-spd')!;
const infoPos = document.getElementById('info-pos')!;

// ═══════════════════════════════════════════════════════════════
//  TIMELINE UI UPDATE
// ═══════════════════════════════════════════════════════════════

function updateTimelineUI(time: JulianDate): void {
  const elapsed = time.secondsDifference(start);
  const ratio = elapsed / FLIGHT_DURATION_SECONDS;
  sliderEl.value = String(Math.round(ratio * 1000));

  timeDisplay.textContent = time.toIso8601().slice(11, 19);
  progressLabel.textContent = `${formatTime(elapsed)} / ${formatTime(FLIGHT_DURATION_SECONDS)}`;
}

// ═══════════════════════════════════════════════════════════════
//  COLLISION DETECTION
// ═══════════════════════════════════════════════════════════════

function obstacleFeatures(): Feature[] {
  return obstacles.map(obs => ({
    id: obs.id,
    geometry: { type: 'Polygon' as const, coordinates: [obs.footprint] },
    attributes: {
      collisionState: obs.collisionState,
      height: obs.height,
      minHeight: 0,
    },
  }));
}

/** Lift a 2D circle geometry to a given altitude by appending Z to each coordinate. */
function liftCircleGeometry(center: [number, number], radiusM: number, alt: number, segments = 48) {
  const geom = createCircleGeometry(center, radiusM, segments);
  const coords = (geom as { coordinates: number[][][] }).coordinates[0]!;
  const lifted = coords.map(c => [c[0]!, c[1]!, alt]);
  return { type: 'Polygon' as const, coordinates: [lifted] };
}

function updateCollisionState(lon: number, lat: number, alt: number): void {
  let dangerCount = 0;
  let warningCount = 0;
  let frustumCount = 0;
  let nearestDist = Infinity;
  let dirty = false;

  // Build frustum for current heading (pitch/roll ignored so frustum stays level)
  const frustum: FrustumGeoResult = createFrustumGeo({
    center: [lon, lat, alt],
    heading: heliState.heading + modelHeadingOffset + modelYaw,
    pitch: 0,
    roll: 0,
    fovH: FRUSTUM_FOV_H,
    fovV: FRUSTUM_FOV_V,
    near: FRUSTUM_NEAR,
    far: FRUSTUM_FAR,
  });

  // Update frustum wireframe (both maps)
  const frustumEdges = frustum.edges.map(([a, b], i) => ({
    id: `frustum-edge-${i}`,
    geometry: {
      type: 'LineString' as const,
      coordinates: [frustum.corners[a]!, frustum.corners[b]!],
    },
    attributes: {},
  }));
  frustumLayer.replaceAll(frustumEdges);
  frustumLayer2d.replaceAll(frustumEdges);

  for (const obs of obstacles) {
    const dist = haversineDistance(lon, lat, obs.lon, obs.lat);
    if (dist < nearestDist) nearestDist = dist;

    // Priority: frustum > danger > warning > safe
    let newState: CollisionState;
    const frustumResult = aabbInFrustum([obs.lon, obs.lat], obs.halfWidth, 0, obs.height, frustum.planes);
    if (frustumResult !== 'outside') {
      newState = 'frustum';
      frustumCount++;
    } else if (dist < DANGER_RADIUS_M) {
      newState = 'danger';
      dangerCount++;
    } else if (dist < WARNING_RADIUS_M) {
      newState = 'warning';
      warningCount++;
    } else {
      newState = 'safe';
    }

    if (newState !== 'safe' && !obs.everHit) {
      obs.everHit = true;
      totalHits++;
    }

    if (newState !== obs.collisionState) {
      obs.prevState = obs.collisionState;
      obs.collisionState = newState;
      dirty = true;
    }
  }

  // Update obstacle layer only when state changed (both maps)
  if (dirty) {
    const features = obstacleFeatures();
    obstacleLayer.replaceAll(features);
    obstacleLayer2d.replaceAll(features);
  }

  // Update ring layers at helicopter altitude (both maps)
  warningCircleLayer.replaceAll([{
    id: 'warning-ring',
    geometry: liftCircleGeometry([lon, lat], WARNING_RADIUS_M, alt, 48),
    attributes: {},
  }]);
  dangerCircleLayer.replaceAll([{
    id: 'danger-ring',
    geometry: liftCircleGeometry([lon, lat], DANGER_RADIUS_M, alt, 48),
    attributes: {},
  }]);

  // 2D: flat circles (no altitude)
  const flatWarning = createCircleGeometry([lon, lat], WARNING_RADIUS_M, 48);
  const flatDanger = createCircleGeometry([lon, lat], DANGER_RADIUS_M, 48);
  warningCircleLayer2d.replaceAll([{
    id: 'warning-ring',
    geometry: flatWarning,
    attributes: {},
  }]);
  dangerCircleLayer2d.replaceAll([{
    id: 'danger-ring',
    geometry: flatDanger,
    attributes: {},
  }]);

  // Update collision HUD
  const statusText = frustumCount > 0 ? 'FRUSTUM' : dangerCount > 0 ? 'DANGER' : warningCount > 0 ? 'WARNING' : 'SAFE';
  const barState = frustumCount > 0 ? 'frustum' : dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'safe';
  collStatusBar.className = `coll-status-bar ${barState}`;
  collStatusEl.textContent = statusText;
  collNearestEl.textContent = Number.isFinite(nearestDist) ? `${(nearestDist / 1000).toFixed(1)} km` : '---';
  collWarningEl.textContent = String(warningCount);
  collDangerEl.textContent = String(dangerCount);
  collFrustumEl.textContent = String(frustumCount);
  collTotalHitsEl.textContent = String(totalHits);
}

// ═══════════════════════════════════════════════════════════════
//  CLOCK TICK HANDLER
// ═══════════════════════════════════════════════════════════════

clock.on('tick', ({ time }) => {
  const currentProgress = clock.progress;

  // Detect loop reset
  if (currentProgress < lastProgress - 0.5) {
    traversedCoords.length = 0;
    wallLayer.clear();
    lastSampleTime = null;
    trailLayer.clear();
    trailLayer2d.clear();
    groundTrailLayer.clear();
    groundTrailLayer2d.clear();
    wallLayer.clear();
  }
  lastProgress = currentProgress;

  // Get interpolated position
  const pos = positionProp.getValue(time);
  const lon = pos[0]!;
  const lat = pos[1]!;
  const alt = pos[2]!;

  // Compute heading from a small look-ahead
  const lookAhead = time.addSeconds(30);
  const posAhead = positionProp.getValue(lookAhead);
  const heading = computeBearing(lon, lat, posAhead[0]!, posAhead[1]!);

  // Approximate speed from distance between current and 30s-ahead position
  const distKm = haversineDistance(lon, lat, posAhead[0]!, posAhead[1]!) / 1000;
  const speedKmh = (distKm / 30) * 3600;
  setHeliState(lon, lat, alt, heading);

  // Collision detection
  updateCollisionState(lon, lat, alt);

  // Update helicopter position (both maps)
  const heliFeature = {
    id: 'heli',
    geometry: { type: 'Point' as const, coordinates: [lon, lat, alt] },
    attributes: { heading },
  };
  heliLayer.replaceAll([heliFeature]);
  heliLayer2d.replaceAll([heliFeature]);

  // Sample trail at intervals (LineString layers)
  const shouldSample = !lastSampleTime ||
    Math.abs(time.secondsDifference(lastSampleTime)) >= SAMPLE_INTERVAL_SECONDS;

  // Wall updates every tick
  wallLayer.append(lon, lat, alt, 0);

  if (shouldSample) {
    traversedCoords.push([lon, lat, alt]);
    lastSampleTime = time;
    updateTrailLayers();
  }

  // Update flight info overlay
  infoAlt.textContent = Math.round(alt).toString();
  infoHdg.textContent = Math.round(heading).toString();
  infoSpd.textContent = Math.round(speedKmh).toString();
  infoPos.textContent = `${lon.toFixed(2)}E, ${lat.toFixed(2)}N`;

  // Update timeline UI
  updateTimelineUI(time);
});

// ═══════════════════════════════════════════════════════════════
//  BUTTON HANDLERS
// ═══════════════════════════════════════════════════════════════

playBtn.addEventListener('click', () => {
  isPlaying = !isPlaying;
  if (isPlaying) {
    clock.start();
    playBtn.textContent = 'Pause';
  } else {
    clock.stop();
    playBtn.textContent = 'Play';
  }
});

resetBtn.addEventListener('click', () => {
  clock.stop();
  clock.reset();
  isPlaying = false;
  playBtn.textContent = 'Play';
  traversedCoords.length = 0;
  wallLayer.clear();
  lastSampleTime = null;
  lastProgress = 0;
  trailLayer.clear();
  trailLayer2d.clear();
  groundTrailLayer.clear();
  groundTrailLayer2d.clear();
  wallLayer.clear();
  const startWp = WAYPOINTS[0]!;
  const nextWp = WAYPOINTS[1]!;
  const resetHeading = computeBearing(startWp.lon, startWp.lat, nextWp.lon, nextWp.lat);
  setHeliState(startWp.lon, startWp.lat, startWp.alt, resetHeading);
  const heliFeature = {
    id: 'heli',
    geometry: { type: 'Point' as const, coordinates: [startWp.lon, startWp.lat, startWp.alt] },
    attributes: { heading: resetHeading },
  };
  heliLayer.replaceAll([heliFeature]);
  heliLayer2d.replaceAll([heliFeature]);
  // Reset collision state
  for (const obs of obstacles) {
    obs.collisionState = 'safe';
    obs.prevState = 'safe';
    obs.everHit = false;
  }
  totalHits = 0;
  const features = obstacleFeatures();
  obstacleLayer.replaceAll(features);
  obstacleLayer2d.replaceAll(features);
  updateCollisionState(startWp.lon, startWp.lat, startWp.alt);
  syncFollowCamera();
  updateTimelineUI(start);
});

speedBadge.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
  clock.multiplier = SPEED_OPTIONS[speedIndex]!;
  speedBadge.textContent = `${clock.multiplier}x`;
});

sliderEl.addEventListener('input', () => {
  const ratio = Number(sliderEl.value) / 1000;
  const offsetSec = ratio * FLIGHT_DURATION_SECONDS;
  clock.currentTime = start.addSeconds(offsetSec);
  rebuildTrailToTime(clock.currentTime);

  // Update helicopter at new position
  const pos = positionProp.getValue(clock.currentTime);
  const lookAhead = clock.currentTime.addSeconds(30);
  const posAhead = positionProp.getValue(lookAhead);
  const heading = computeBearing(pos[0]!, pos[1]!, posAhead[0]!, posAhead[1]!);

  const scrubHeli = {
    id: 'heli',
    geometry: { type: 'Point' as const, coordinates: [pos[0]!, pos[1]!, pos[2]!] },
    attributes: { heading },
  };
  heliLayer.replaceAll([scrubHeli]);
  heliLayer2d.replaceAll([scrubHeli]);
  setHeliState(pos[0]!, pos[1]!, pos[2]!, heading);
  updateCollisionState(pos[0]!, pos[1]!, pos[2]!);
  if (followMode) void syncFollowCamera();

  updateTimelineUI(clock.currentTime);
});

btnFollow.addEventListener('click', async () => {
  followMode = !followMode;
  await syncFollowCamera(true);
  btnFollow.textContent = followMode ? 'Unfollow' : 'Follow Heli';
  if (followMode) btnFollow.classList.add('active');
  else btnFollow.classList.remove('active');
});

// ═══════════════════════════════════════════════════════════════
//  MODEL ORIENTATION CONTROLS
// ═══════════════════════════════════════════════════════════════

const yawSlider = document.getElementById('model-yaw') as HTMLInputElement;
const pitchSlider = document.getElementById('model-pitch') as HTMLInputElement;
const rollSlider = document.getElementById('model-roll') as HTMLInputElement;
const scaleSlider = document.getElementById('model-scale') as HTMLInputElement;
const yawVal = document.getElementById('model-yaw-val')!;
const pitchVal = document.getElementById('model-pitch-val')!;
const rollVal = document.getElementById('model-roll-val')!;
const scaleVal = document.getElementById('model-scale-val')!;

scaleSlider.value = String(DEFAULT_MODEL_SCALE);
updateScaleReadout();

function getEffectiveModelScale(context?: SymbolRenderContext): number {
  const zoom = context?.zoom ?? view3d.zoom;
  const zoomBoost = Math.pow(2, Math.max(0, MODEL_SCALE_REFERENCE_ZOOM - zoom));
  return Math.min(MAX_AUTO_SCALE, modelScale * zoomBoost);
}

function getModelAnchorZ(context?: SymbolRenderContext): number {
  return (modelMetadata?.groundAnchorLocalZ ?? 0) * getEffectiveModelScale(context);
}

function resolveCurrentModelBounds(context?: SymbolRenderContext) {
  return view3d.resolveModelBounds({
    modelId: MODEL_ID,
    coordinates: [heliState.lon, heliState.lat, heliState.alt],
    scale: getEffectiveModelScale(context),
    heading: heliState.heading + modelHeadingOffset + modelYaw,
    pitch: modelPitch,
    roll: modelRoll,
    anchorZ: getModelAnchorZ(context),
  });
}

function updateScaleReadout(context?: SymbolRenderContext): void {
  const effectiveScale = Math.round(getEffectiveModelScale(context));
  scaleVal.textContent = effectiveScale === modelScale ? String(modelScale) : `${modelScale}→${effectiveScale}`;
}

function refreshRenderer(): void {
  heliLayer.renderer = new CallbackRenderer((feature: Feature, context?: SymbolRenderContext) => {
    const heading = ((feature.attributes.heading as number) ?? 0) + modelHeadingOffset + modelYaw;
    return {
      type: 'model',
      modelId: MODEL_ID,
      scale: getEffectiveModelScale(context),
      heading,
      pitch: modelPitch,
      roll: modelRoll,
      anchorZ: getModelAnchorZ(context),
    } as ModelSymbol;
  });
  updateScaleReadout();
}

yawSlider.addEventListener('input', () => {
  modelYaw = Number(yawSlider.value);
  yawVal.textContent = `${modelYaw}\u00B0`;
  refreshRenderer();
});

pitchSlider.addEventListener('input', () => {
  modelPitch = Number(pitchSlider.value);
  pitchVal.textContent = `${modelPitch}\u00B0`;
  refreshRenderer();
});

rollSlider.addEventListener('input', () => {
  modelRoll = Number(rollSlider.value);
  rollVal.textContent = `${modelRoll}\u00B0`;
  refreshRenderer();
});

scaleSlider.addEventListener('input', () => {
  modelScale = Number(scaleSlider.value);
  refreshRenderer();
});

view3d.on('zoomend', ({ zoom }) => {
  updateScaleReadout({ renderMode: '3d', zoom, resolution: 0 });
});

// ═══════════════════════════════════════════════════════════════
//  COLLISION TOOLBAR HANDLERS
// ═══════════════════════════════════════════════════════════════

warningRadiusSlider.addEventListener('input', () => {
  WARNING_RADIUS_M = Number(warningRadiusSlider.value);
  // Clamp danger <= warning
  if (DANGER_RADIUS_M > WARNING_RADIUS_M) {
    DANGER_RADIUS_M = WARNING_RADIUS_M;
    dangerRadiusSlider.value = String(DANGER_RADIUS_M);
    dangerRadiusVal.textContent = `${Math.round(DANGER_RADIUS_M / 1000)}km`;
  }
  warningRadiusVal.textContent = `${Math.round(WARNING_RADIUS_M / 1000)}km`;
  updateCollisionState(heliState.lon, heliState.lat, heliState.alt);
});

dangerRadiusSlider.addEventListener('input', () => {
  DANGER_RADIUS_M = Math.min(Number(dangerRadiusSlider.value), WARNING_RADIUS_M);
  dangerRadiusSlider.value = String(DANGER_RADIUS_M);
  dangerRadiusVal.textContent = `${Math.round(DANGER_RADIUS_M / 1000)}km`;
  updateCollisionState(heliState.lon, heliState.lat, heliState.alt);
});

obstacleCountSlider.addEventListener('input', () => {
  obstacleCount = Number(obstacleCountSlider.value);
  obstacleCountVal.textContent = String(obstacleCount);
  obstacles = generateObstacles(obstacleCount, obstacleSeed);
  totalHits = 0;
  const features = obstacleFeatures();
  obstacleLayer.replaceAll(features);
  obstacleLayer2d.replaceAll(features);
  updateCollisionState(heliState.lon, heliState.lat, heliState.alt);
});

btnRegen.addEventListener('click', () => {
  obstacleSeed++;
  obstacles = generateObstacles(obstacleCount, obstacleSeed);
  totalHits = 0;
  const features = obstacleFeatures();
  obstacleLayer.replaceAll(features);
  obstacleLayer2d.replaceAll(features);
  updateCollisionState(heliState.lon, heliState.lat, heliState.alt);
});

btnToggleObs.addEventListener('click', () => {
  obstaclesVisible = !obstaclesVisible;
  if (obstaclesVisible) {
    view3d.map.add(obstacleLayer);
    view2d.map.add(obstacleLayer2d);
    btnToggleObs.textContent = 'Hide Obstacles';
  } else {
    view3d.map.remove(obstacleLayer);
    view2d.map.remove(obstacleLayer2d);
    btnToggleObs.textContent = 'Show Obstacles';
  }
});

// ═══════════════════════════════════════════════════════════════
//  MAIN INIT
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  DTED TERRAIN LAYER
// ═══════════════════════════════════════════════════════════════

const terrainLayer = new DTEDLayer({
  id: 'dted-terrain',
  mode: 'hybrid',
  levels: ['dt2', 'dt1', 'dt0'],
  exaggeration: 1,
  tileSize: 256,
  hillshade2D: {
    enabled: true,
    opacity: 0.6,
    azimuth: 315,
    altitude: 45,
    softness: 0.25,
  },
  lighting3D: {
    enabled: true,
    sunAzimuth: 315,
    sunAltitude: 45,
    ambient: 0.35,
    diffuse: 0.85,
    shadowStrength: 0.35,
    shadowSoftness: 0.25,
  },
});

// ═══════════════════════════════════════════════════════════════
//  DTED DRAG & DROP
// ═══════════════════════════════════════════════════════════════

const DTED_EXTENSIONS = ['.dt0', '.dt1', '.dt2'];
const dropOverlay = document.getElementById('dted-drop-overlay')!;
const dtedStatusEl = document.getElementById('dted-status')!;
let dtedFileCount = 0;

function isDTEDFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return DTED_EXTENSIONS.some(ext => name.endsWith(ext));
}

function hasDTEDFiles(dt: DataTransfer): boolean {
  for (const item of dt.items) {
    if (item.kind === 'file') {
      const name = item.type || item.getAsFile()?.name?.toLowerCase() || '';
      if (DTED_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
    }
  }
  // DataTransfer.items may not expose filenames during dragover, so allow all file drags
  return dt.items.length > 0;
}

function updateDtedStatus(): void {
  if (dtedFileCount === 0) {
    dtedStatusEl.innerHTML = '';
    return;
  }
  const info = terrainLayer.getStoreInfo();
  const extent = info.fullExtent;
  dtedStatusEl.innerHTML = [
    `<br>DTED: <span class="val">${info.cells.length}</span> cell`,
    extent ? ` | [${extent.minX},${extent.minY}]-[${extent.maxX},${extent.maxY}]` : '',
  ].join('');
}

let dragCounter = 0;

container3d.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  if (e.dataTransfer && hasDTEDFiles(e.dataTransfer)) {
    dropOverlay.classList.add('active');
  }
});

container3d.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});

container3d.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.remove('active');
  }
});

container3d.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('active');

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  let loaded = 0;
  for (const file of files) {
    if (!isDTEDFile(file)) {
      continue;
    }
    try {
      await terrainLayer.addLocalFile(file);
      loaded++;
      dtedFileCount++;
    } catch {
      // DTED load error — skip file
    }
  }

  if (loaded > 0) {
    terrainLayer.refresh();
    updateDtedStatus();
  }
});

async function main() {
  // Add basemap to both maps
  view3d.map.add(new RasterTileLayer({
    id: 'osm-3d',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
  }));
  view2d.map.add(new RasterTileLayer({
    id: 'osm-2d',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
  }));

  await Promise.all([view3d.when(), view2d.when()]);

  // Load helicopter model (3D only)
  await view3d.loadModelV2(MODEL_ID, '/models/sikorsky.gltf');
  modelMetadata = view3d.getModelMetadata(MODEL_ID);

  // Auto-detect heading offset from model bounding box.
  // In ENU: X=East, Y=North. If the fuselage (longest axis) is along X,
  // the model's nose faces East → need -90° to align with North (heading 0°).
  if (modelMetadata) {
    const b = modelMetadata.localBounds;
    const extX = b.max[0] - b.min[0];
    const extY = b.max[1] - b.min[1];
    if (extX > extY * 1.2) {
      // Fuselage along X-axis: nose faces East → rotate -90° to face North
      modelHeadingOffset = -90;
    } else if (extY > extX * 1.2) {
      // Fuselage along Y-axis: nose faces North → no offset
      modelHeadingOffset = 0;
    }
  }

  // Setup helicopter layer with CallbackRenderer for dynamic heading (3D model)
  heliLayer.renderer = new CallbackRenderer((feature: Feature, context?: SymbolRenderContext) => {
    const heading = ((feature.attributes.heading as number) ?? 0) + modelHeadingOffset + modelYaw;
    return {
      type: 'model',
      modelId: MODEL_ID,
      scale: getEffectiveModelScale(context),
      heading,
      pitch: modelPitch,
      roll: modelRoll,
      anchorZ: getModelAnchorZ(context),
    } as ModelSymbol;
  });

  // Setup 2D helicopter renderer (simple point marker with heading)
  heliLayer2d.renderer = new CallbackRenderer((feature: Feature) => {
    return {
      type: 'simple-marker',
      color: [255, 109, 58, 255],
      size: 10,
      outlineColor: [255, 255, 255, 255],
      outlineWidth: 2,
    } as never;
  });

  // Populate features BEFORE adding layers to map
  const routeCoords = WAYPOINTS.map(wp => [wp.lon, wp.lat, wp.alt]);
  const routeFeature = {
    id: 'route-preview',
    geometry: { type: 'LineString' as const, coordinates: routeCoords },
    attributes: {},
  };
  routePreviewLayer.add(routeFeature);
  routePreviewLayer2d.add(routeFeature);

  const startWp = WAYPOINTS[0]!;
  const nextWp = WAYPOINTS[1]!;
  const initHeading = computeBearing(startWp.lon, startWp.lat, nextWp.lon, nextWp.lat);
  setHeliState(startWp.lon, startWp.lat, startWp.alt, initHeading);
  const initHeli = {
    id: 'heli',
    geometry: { type: 'Point' as const, coordinates: [startWp.lon, startWp.lat, startWp.alt] },
    attributes: { heading: initHeading },
  };
  heliLayer.add(initHeli);
  heliLayer2d.add(initHeli);

  // Generate obstacles along the route
  obstacles = generateObstacles(obstacleCount, obstacleSeed);
  const initObstacles = obstacleFeatures();
  obstacleLayer.replaceAll(initObstacles);
  obstacleLayer2d.replaceAll(initObstacles);

  // Set elevation mode — terrain-relative so features follow DTED surface
  obstacleLayer.setElevationInfo({ mode: 'relative-to-ground' });
  routePreviewLayer.setElevationInfo({ mode: 'relative-to-ground' });
  groundTrailLayer.setElevationInfo({ mode: 'on-the-ground' });
  warningCircleLayer.setElevationInfo({ mode: 'relative-to-ground', sampling: 'centroid' });
  dangerCircleLayer.setElevationInfo({ mode: 'on-the-ground' });
  frustumLayer.setElevationInfo({ mode: 'relative-to-ground' });
  wallLayer.setElevationInfo({ mode: 'relative-to-ground' });
  trailLayer.setElevationInfo({ mode: 'relative-to-ground' });
  heliLayer.setElevationInfo({ mode: 'relative-to-ground' });

  // Add layers to 3D map (bottom to top)
  view3d.map.add(terrainLayer);
  view3d.map.add(obstacleLayer);
  view3d.map.add(routePreviewLayer);
  view3d.map.add(groundTrailLayer);
  view3d.map.add(warningCircleLayer);
  view3d.map.add(dangerCircleLayer);
  view3d.map.add(frustumLayer);
  view3d.map.add(wallLayer);
  view3d.map.add(trailLayer);
  view3d.map.add(heliLayer);

  // Add layers to 2D map (no terrain, no wall)
  view2d.map.add(obstacleLayer2d);
  view2d.map.add(routePreviewLayer2d);
  view2d.map.add(groundTrailLayer2d);
  view2d.map.add(warningCircleLayer2d);
  view2d.map.add(dangerCircleLayer2d);
  view2d.map.add(frustumLayer2d);
  view2d.map.add(trailLayer2d);
  view2d.map.add(heliLayer2d);

  // ─── Camera Synchronization (bidirectional, center+zoom only) ───
  let _syncing = false;
  view3d.on('view-change', ({ center, zoom }) => {
    if (_syncing) return;
    _syncing = true;
    view2d.goTo({ center, zoom, duration: 0 });
    _syncing = false;
  });
  view2d.on('view-change', ({ center, zoom }) => {
    if (_syncing) return;
    _syncing = true;
    view3d.goTo({ center, zoom, duration: 0 });
    _syncing = false;
  });

  // Initialize timeline
  updateTimelineUI(start);

  // Initial collision state at start position
  updateCollisionState(startWp.lon, startWp.lat, startWp.alt);

  updateScaleReadout();

  // ─── Route Drawing Tool ───
  const routeDrawLayer = new GraphicsLayer({ id: 'route-draw-target' });
  const routePreviewDrawLayer = new GraphicsLayer({ id: '__route-draw-preview__' });
  view3d.map.add(routeDrawLayer);
  view3d.map.add(routePreviewDrawLayer);

  const drawRouteTool = new DrawPolylineTool({ targetLayer: routeDrawLayer });
  const tm = view3d.toolManager;
  tm.setPreviewLayer(routePreviewDrawLayer);
  tm.registerTool(drawRouteTool);

  const btnDrawRoute = document.getElementById('btn-draw-route')!;
  let drawingRoute = false;

  btnDrawRoute.addEventListener('click', () => {
    if (!drawingRoute) {
      // Start drawing
      clock.stop();
      isPlaying = false;
      playBtn.textContent = 'Play';
      tm.activateTool('draw-polyline');
      drawingRoute = true;
      btnDrawRoute.textContent = 'Cancel Draw';
      btnDrawRoute.classList.add('active');
    } else {
      // Cancel drawing
      drawRouteTool.cancel();
      tm.deactivateTool();
      drawingRoute = false;
      btnDrawRoute.textContent = 'Draw Route';
      btnDrawRoute.classList.remove('active');
    }
  });

  tm.on('draw-complete', ({ feature }) => {
    drawingRoute = false;
    btnDrawRoute.textContent = 'Draw Route';
    btnDrawRoute.classList.remove('active');
    // Note: don't call tm.deactivateTool() here — it runs synchronously inside
    // the tool's _finishDrawing and would null the context mid-execution.
    // The tool resets itself to 'active' state after emitting draw-complete.
    routeDrawLayer.clear();

    const coords = feature.geometry.coordinates as [number, number][];
    if (coords.length < 2) return;

    // Build new waypoints from drawn route (use DEFAULT_CRUISE_ALT for all)
    WAYPOINTS = coords.map(([lon, lat]) => ({ lon, lat, alt: DEFAULT_CRUISE_ALT }));
    rebuildPositionProp();

    // Regenerate obstacles for new route
    obstacles = generateObstacles(obstacleCount, obstacleSeed);
    const drawnObstacles = obstacleFeatures();
    obstacleLayer.replaceAll(drawnObstacles);
    obstacleLayer2d.replaceAll(drawnObstacles);

    // Update route preview line (both maps)
    const routeCoords = WAYPOINTS.map(wp => [wp.lon, wp.lat, wp.alt]);
    const routeFeature = {
      id: 'route-preview',
      geometry: { type: 'LineString' as const, coordinates: routeCoords },
      attributes: {},
    };
    routePreviewLayer.replaceAll([routeFeature]);
    routePreviewLayer2d.replaceAll([routeFeature]);

    // Reset flight to beginning
    clock.stop();
    clock.reset();
    isPlaying = false;
    playBtn.textContent = 'Play';
    traversedCoords.length = 0;
    wallLayer.clear();
    lastSampleTime = null;
    lastProgress = 0;
    trailLayer.clear();
    trailLayer2d.clear();
    groundTrailLayer.clear();
    groundTrailLayer2d.clear();

    const startWp = WAYPOINTS[0]!;
    const nextWp = WAYPOINTS[1]!;
    const heading = computeBearing(startWp.lon, startWp.lat, nextWp.lon, nextWp.lat);
    setHeliState(startWp.lon, startWp.lat, 0, heading); // ground level at start
    const drawnHeli = {
      id: 'heli',
      geometry: { type: 'Point' as const, coordinates: [startWp.lon, startWp.lat, 0] },
      attributes: { heading },
    };
    heliLayer.replaceAll([drawnHeli]);
    heliLayer2d.replaceAll([drawnHeli]);

    // Reset collision
    for (const obs of obstacles) {
      obs.collisionState = 'safe';
      obs.prevState = 'safe';
      obs.everHit = false;
    }
    totalHits = 0;
    const resetObstacles = obstacleFeatures();
    obstacleLayer.replaceAll(resetObstacles);
    obstacleLayer2d.replaceAll(resetObstacles);
    updateCollisionState(startWp.lon, startWp.lat, 0);
    updateTimelineUI(start);

    // Zoom to new route (both maps)
    const lons = WAYPOINTS.map(w => w.lon);
    const lats = WAYPOINTS.map(w => w.lat);
    const bounds: [number, number, number, number] = [Math.min(...lons) - 0.5, Math.min(...lats) - 0.5, Math.max(...lons) + 0.5, Math.max(...lats) + 0.5];
    view3d.fitBounds(bounds);
    view2d.fitBounds(bounds);
  });
}

main().catch(console.error);
