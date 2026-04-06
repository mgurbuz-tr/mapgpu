import type {
  Feature,
  IRenderer,
  SerializableClassBreakInfo,
  SerializableRendererSnapshot,
  SerializableUniqueValueInfo,
  VectorRenderableSymbol,
} from '@mapgpu/core';

function isSymbol(value: unknown): value is VectorRenderableSymbol {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

const SAMPLE_FEATURE: Feature = {
  id: '__snapshot__',
  attributes: {},
  geometry: { type: 'Point', coordinates: [0, 0] },
};

export function createSerializableRendererSnapshot(
  renderer?: IRenderer,
): SerializableRendererSnapshot | null {
  if (!renderer) return null;

  if (renderer.type === 'simple') {
    const symbol = renderer.getSymbol(SAMPLE_FEATURE);
    if (!isSymbol(symbol)) return null;
    return {
      type: 'simple',
      symbol,
      zoomSensitive: renderer.zoomSensitive,
    };
  }

  if (renderer.type === 'unique-value') {
    const unique = renderer as IRenderer & {
      field?: unknown;
      defaultSymbol?: unknown;
      uniqueValues?: unknown;
    };
    if (
      typeof unique.field !== 'string' ||
      !isSymbol(unique.defaultSymbol) ||
      !Array.isArray(unique.uniqueValues)
    ) {
      return null;
    }

    const serialized: SerializableUniqueValueInfo[] = [];
    for (const entry of unique.uniqueValues) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        (!Object.prototype.hasOwnProperty.call(entry, 'value')) ||
        !isSymbol((entry as { symbol?: unknown }).symbol)
      ) {
        return null;
      }
      const value = (entry as { value: unknown }).value;
      if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
      }
      serialized.push({
        value,
        symbol: (entry as { symbol: VectorRenderableSymbol }).symbol,
      });
    }

    return {
      type: 'unique-value',
      field: unique.field,
      defaultSymbol: unique.defaultSymbol,
      uniqueValues: serialized,
      zoomSensitive: renderer.zoomSensitive,
    };
  }

  if (renderer.type === 'class-breaks') {
    const classBreaks = renderer as IRenderer & {
      field?: unknown;
      defaultSymbol?: unknown;
      breaks?: unknown;
    };
    if (
      typeof classBreaks.field !== 'string' ||
      !isSymbol(classBreaks.defaultSymbol) ||
      !Array.isArray(classBreaks.breaks)
    ) {
      return null;
    }

    const serialized: SerializableClassBreakInfo[] = [];
    for (const entry of classBreaks.breaks) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        typeof (entry as { min?: unknown }).min !== 'number' ||
        typeof (entry as { max?: unknown }).max !== 'number' ||
        !isSymbol((entry as { symbol?: unknown }).symbol)
      ) {
        return null;
      }

      serialized.push({
        min: (entry as { min: number }).min,
        max: (entry as { max: number }).max,
        symbol: (entry as { symbol: VectorRenderableSymbol }).symbol,
      });
    }

    return {
      type: 'class-breaks',
      field: classBreaks.field,
      defaultSymbol: classBreaks.defaultSymbol,
      breaks: serialized,
      zoomSensitive: renderer.zoomSensitive,
    };
  }

  return null;
}
