/**
 * Test Utilities
 *
 * Custom assertions and mock data generators for mapgpu tests.
 */

import type { Extent, Feature } from '../core/index.js';

// ─── Custom Assertions ───

/**
 * Assert that the outer extent fully contains the inner extent.
 * Throws an error with descriptive message if the assertion fails.
 */
export function expectExtentContains(outer: Extent, inner: Extent): void {
  if (inner.minX < outer.minX) {
    throw new Error(
      `Extent assertion failed: inner.minX (${inner.minX}) < outer.minX (${outer.minX})`,
    );
  }
  if (inner.minY < outer.minY) {
    throw new Error(
      `Extent assertion failed: inner.minY (${inner.minY}) < outer.minY (${outer.minY})`,
    );
  }
  if (inner.maxX > outer.maxX) {
    throw new Error(
      `Extent assertion failed: inner.maxX (${inner.maxX}) > outer.maxX (${outer.maxX})`,
    );
  }
  if (inner.maxY > outer.maxY) {
    throw new Error(
      `Extent assertion failed: inner.maxY (${inner.maxY}) > outer.maxY (${outer.maxY})`,
    );
  }
}

/**
 * Assert that two numbers are approximately equal within a given epsilon.
 */
export function expectNearEqual(
  a: number,
  b: number,
  epsilon: number = 1e-6,
): void {
  const diff = Math.abs(a - b);
  if (diff > epsilon) {
    throw new Error(
      `Near-equal assertion failed: |${a} - ${b}| = ${diff} > epsilon ${epsilon}`,
    );
  }
}

// ─── Mock Data ───

/**
 * Create an array of mock Feature objects with Point geometry.
 * Useful for testing feature-consuming code without needing real data.
 */
export function createMockFeatures(count: number): Feature[] {
  const features: Feature[] = [];

  for (let i = 0; i < count; i++) {
    features.push({
      id: i + 1,
      geometry: {
        type: 'Point',
        coordinates: [
          29 + (i % 100) * 0.01,
          41 + Math.floor(i / 100) * 0.01,
        ],
      },
      attributes: {
        name: `Feature ${i + 1}`,
        value: i * 10,
        active: i % 2 === 0,
      },
    });
  }

  return features;
}
