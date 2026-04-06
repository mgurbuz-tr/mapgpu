---
title: LOS Analysis
order: 8
section: Analysis
---

## Line of Sight Analysis

Interactive Line of Sight analysis system with terrain and building obstacle detection.

### Architecture

```
LosTool (interactive)          LOSWidget (UI)
    │                              │
    ▼                              ▼
LosAnalysis ◄──── IElevationProvider
    │                  │
    ▼                  ├── TerrainElevationProvider (DTED/TerrainRGB)
IWasmCore              ├── BuildingObstacleProvider (MVT footprints)
    │                  └── CompositeElevationProvider (max aggregation)
    ▼
generateLosSegments() → computeLos() → LosAnalysisResult
```

### Elevation Providers

`IElevationProvider` decouples elevation data from the LOS algorithm:

- **TerrainElevationProvider**: Wraps `ITerrainLayer[]`, queries height tiles with bilinear interpolation
- **BuildingObstacleProvider**: Two-phase detection:
  - Phase 1: Point-in-polygon for each sample point
  - Phase 2: Full LOS line-segment vs polygon-edge intersection (catches narrow buildings)
- **CompositeElevationProvider**: Chains providers, returns `max()` elevation

### LosTool State Machine

```
active ──[click]──→ observer-placed ──[click]──→ showing-result
                         │                            │
                         └──[Escape]──→ active  ←─────┘ (auto-deactivate)
```

After result: tool auto-deactivates, LOS visualization persists on dedicated `GraphicsLayer`s with `SimpleRenderer` (green=visible, red=blocked).

### Globe Z Scaling

Globe vector pipelines apply `ALTITUDE_EXAG = 5.0` but extrusion pipeline (buildings) does not. LOS geometry compensates with `EXTRUSION_SCALE_MATCH = 1/5`:

```
Visual Z = offset_meters × (1/5)
Shader:    Z / EARTH_RADIUS × 5  =  offset_meters / EARTH_RADIUS
Result:    Same scale as building extrusions
```

### Profile Chart

Canvas2D elevation profile showing terrain surface, LOS ray (green/red), observer/target markers, and blocking point indicator. Updates live when height sliders change.

### Key Files

| File | Package | Role |
|------|---------|------|
| `IElevationProvider.ts` | analysis | Provider interface |
| `TerrainElevationProvider.ts` | analysis | Terrain wrapper |
| `BuildingObstacleProvider.ts` | analysis | Building obstacles |
| `CompositeElevationProvider.ts` | analysis | Provider chain |
| `LosAnalysis.ts` | analysis | Core algorithm |
| `LosTool.ts` | tools | Interactive tool |
| `LOSWidget.ts` | widgets | UI control + profile chart |
| `line-intersects-polygon.ts` | analysis | Segment intersection |
| `point-in-polygon.ts` | analysis | PIP test |
