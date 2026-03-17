export { DTEDLayer } from './DTEDLayer.js';
export { TerrainRGBLayer } from './TerrainRGBLayer.js';
export type {
  DTEDLayerOptions,
  DTEDLevelName,
  DTEDMode,
  DTEDLocalFile,
  DTEDTile,
  DTEDHeader,
  Hillshade2DOptions,
  HillshadeComputeFn,
  TerrainRGBLayerOptions,
  TerrainRGBTileJSON,
  TerrainRGBEncoding,
  TerrainRGBPixelFetcher,
  TerrainRGBImageData,
} from './types.js';

export { parseDTED, detectDTEDLevel, extractCoordsFromFilename } from './parsers/dted-parser.js';
export { DTEDTileStore } from './DTEDTileStore.js';
export { computeHillshadeTS, estimateCellSizeMeters } from './hillshade.js';
