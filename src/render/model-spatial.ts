import { lonLatToMercator, mercatorToLonLat } from '../core/index.js';
import type { Bounds3D, ModelBoundsQuery, ModelMetadata, ResolvedModelBounds } from '../core/index.js';
import { multiplyMat4 } from './gpu-math.js';

export type Matrix4 = Float32Array<ArrayBufferLike>;

export interface SpatialNode {
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  children: number[];
  parentIndex: number | null;
}

export interface PrimitiveSpatialBounds {
  bounds: Bounds3D;
  nodeIndex: number | null;
}

const IDENTITY_MAT4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

function cloneBounds(bounds: Bounds3D): Bounds3D {
  return {
    min: [bounds.min[0], bounds.min[1], bounds.min[2]],
    max: [bounds.max[0], bounds.max[1], bounds.max[2]],
  };
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function createEmptyBounds(): Bounds3D {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

export function expandBounds(bounds: Bounds3D, point: readonly [number, number, number]): void {
  if (point[0] < bounds.min[0]) bounds.min[0] = point[0];
  if (point[1] < bounds.min[1]) bounds.min[1] = point[1];
  if (point[2] < bounds.min[2]) bounds.min[2] = point[2];
  if (point[0] > bounds.max[0]) bounds.max[0] = point[0];
  if (point[1] > bounds.max[1]) bounds.max[1] = point[1];
  if (point[2] > bounds.max[2]) bounds.max[2] = point[2];
}

export function finalizeBounds(bounds: Bounds3D): Bounds3D {
  if (!Number.isFinite(bounds.min[0])) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
    };
  }
  bounds.min[0] = normalizeZero(bounds.min[0]);
  bounds.min[1] = normalizeZero(bounds.min[1]);
  bounds.min[2] = normalizeZero(bounds.min[2]);
  bounds.max[0] = normalizeZero(bounds.max[0]);
  bounds.max[1] = normalizeZero(bounds.max[1]);
  bounds.max[2] = normalizeZero(bounds.max[2]);
  return bounds;
}

export function canonicalizeGltfPoint(point: readonly [number, number, number]): [number, number, number] {
  return [point[0], -point[2], point[1]];
}

export function canonicalizeGltfVector(vector: readonly [number, number, number]): [number, number, number] {
  return [vector[0], -vector[2], vector[1]];
}

export function getOrderedBoundsCorners(bounds: Bounds3D): [number, number, number][] {
  const minX = bounds.min[0];
  const minY = bounds.min[1];
  const minZ = bounds.min[2];
  const maxX = bounds.max[0];
  const maxY = bounds.max[1];
  const maxZ = bounds.max[2];
  return [
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [maxX, maxY, minZ],
    [minX, maxY, minZ],
    [minX, minY, maxZ],
    [maxX, minY, maxZ],
    [maxX, maxY, maxZ],
    [minX, maxY, maxZ],
  ];
}

function normalizeQuat(rotation: readonly [number, number, number, number]): [number, number, number, number] {
  const length = Math.hypot(rotation[0], rotation[1], rotation[2], rotation[3]) || 1;
  return [
    rotation[0] / length,
    rotation[1] / length,
    rotation[2] / length,
    rotation[3] / length,
  ];
}

export function createTrsMatrix(
  translation: readonly [number, number, number],
  rotation: readonly [number, number, number, number],
  scale: readonly [number, number, number],
): Matrix4 {
  const [qx, qy, qz, qw] = normalizeQuat(rotation);
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;

  const r00 = 1 - (yy + zz);
  const r01 = xy - wz;
  const r02 = xz + wy;
  const r10 = xy + wz;
  const r11 = 1 - (xx + zz);
  const r12 = yz - wx;
  const r20 = xz - wy;
  const r21 = yz + wx;
  const r22 = 1 - (xx + yy);

  return new Float32Array([
    r00 * scale[0], r10 * scale[0], r20 * scale[0], 0,
    r01 * scale[1], r11 * scale[1], r21 * scale[1], 0,
    r02 * scale[2], r12 * scale[2], r22 * scale[2], 0,
    translation[0], translation[1], translation[2], 1,
  ]);
}

export function transformPointMat4(
  matrix: ArrayLike<number>,
  point: readonly [number, number, number],
): [number, number, number] {
  return [
    matrix[0]! * point[0] + matrix[4]! * point[1] + matrix[8]! * point[2] + matrix[12]!,
    matrix[1]! * point[0] + matrix[5]! * point[1] + matrix[9]! * point[2] + matrix[13]!,
    matrix[2]! * point[0] + matrix[6]! * point[1] + matrix[10]! * point[2] + matrix[14]!,
  ];
}

function invert3x3Transpose(matrix: ArrayLike<number>): Matrix4 {
  const a00 = matrix[0]!;
  const a01 = matrix[4]!;
  const a02 = matrix[8]!;
  const a10 = matrix[1]!;
  const a11 = matrix[5]!;
  const a12 = matrix[9]!;
  const a20 = matrix[2]!;
  const a21 = matrix[6]!;
  const a22 = matrix[10]!;

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(det) < 1e-8) {
    return new Float32Array(IDENTITY_MAT4);
  }
  det = 1 / det;

  const inv00 = b01 * det;
  const inv01 = (-a22 * a01 + a02 * a21) * det;
  const inv02 = (a12 * a01 - a02 * a11) * det;
  const inv10 = b11 * det;
  const inv11 = (a22 * a00 - a02 * a20) * det;
  const inv12 = (-a12 * a00 + a02 * a10) * det;
  const inv20 = b21 * det;
  const inv21 = (-a21 * a00 + a01 * a20) * det;
  const inv22 = (a11 * a00 - a01 * a10) * det;

  return new Float32Array([
    inv00, inv01, inv02, 0,
    inv10, inv11, inv12, 0,
    inv20, inv21, inv22, 0,
    0, 0, 0, 1,
  ]);
}

export function writeNodeUniformMatrices(
  out: Float32Array,
  offset: number,
  worldMatrix: ArrayLike<number>,
  normalMatrix: ArrayLike<number>,
): void {
  out.set(worldMatrix, offset);
  out.set(normalMatrix, offset + 16);
}

export function computeWorldMatrices(
  nodes: readonly SpatialNode[],
  translations: readonly [number, number, number][],
  rotations: readonly [number, number, number, number][],
  scales: readonly [number, number, number][],
): { worldMatrices: Matrix4[]; normalMatrices: Matrix4[] } {
  const localMatrices: Matrix4[] = nodes.map((node, index) =>
    createTrsMatrix(
      translations[index] ?? node.translation,
      rotations[index] ?? node.rotation,
      scales[index] ?? node.scale,
    ),
  );

  const worldMatrices: Matrix4[] = nodes.map(() => new Float32Array(IDENTITY_MAT4));
  const normalMatrices: Matrix4[] = nodes.map(() => new Float32Array(IDENTITY_MAT4));
  const resolved = new Array(nodes.length).fill(false);

  const resolveNode = (index: number): void => {
    if (resolved[index]) return;
    const node = nodes[index]!;
    const localMatrix = localMatrices[index]!;
    if (node.parentIndex === null || node.parentIndex < 0) {
      worldMatrices[index] = localMatrix;
    } else {
      resolveNode(node.parentIndex);
      worldMatrices[index] = multiplyMat4(worldMatrices[node.parentIndex]!, localMatrix);
    }
    normalMatrices[index] = invert3x3Transpose(worldMatrices[index]);
    resolved[index] = true;
  };

  for (let i = 0; i < nodes.length; i++) {
    resolveNode(i);
  }

  return { worldMatrices, normalMatrices };
}

export function computeCanonicalLocalBounds(
  primitives: readonly PrimitiveSpatialBounds[],
  worldMatrices: readonly Matrix4[],
): Bounds3D {
  const bounds = createEmptyBounds();

  for (const primitive of primitives) {
    const matrix = primitive.nodeIndex === null
      ? IDENTITY_MAT4
      : (worldMatrices[primitive.nodeIndex] ?? IDENTITY_MAT4);
    for (const corner of getOrderedBoundsCorners(primitive.bounds)) {
      expandBounds(bounds, canonicalizeGltfPoint(transformPointMat4(matrix, corner)));
    }
  }

  return finalizeBounds(bounds);
}

export function buildModelMetadata(
  restLocalBounds: Bounds3D,
  currentLocalBounds: Bounds3D,
  isAnimated: boolean,
  hasHierarchy: boolean,
): ModelMetadata {
  const restBounds = cloneBounds(restLocalBounds);
  const currentBounds = cloneBounds(currentLocalBounds);
  return {
    localBounds: cloneBounds(currentBounds),
    restLocalBounds: restBounds,
    currentLocalBounds: currentBounds,
    groundAnchorLocalZ: -currentBounds.min[2],
    restGroundAnchorLocalZ: -restBounds.min[2],
    currentGroundAnchorLocalZ: -currentBounds.min[2],
    units: 'meters',
    localAxes: 'east-north-up',
    isAnimated,
    hasHierarchy,
  };
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function rotateLocalOffset(
  x: number,
  y: number,
  z: number,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
): [number, number, number] {
  const h = degreesToRadians(headingDeg);
  const p = degreesToRadians(pitchDeg);
  const r = degreesToRadians(rollDeg);

  const ch = Math.cos(h);
  const sh = Math.sin(h);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cr = Math.cos(r);
  const sr = Math.sin(r);

  return [
    ch * cp * x + (ch * sp * sr - sh * cr) * y + (ch * sp * cr + sh * sr) * z,
    sh * cp * x + (sh * sp * sr + ch * cr) * y + (sh * sp * cr - ch * sr) * z,
    -sp * x + cp * sr * y + cp * cr * z,
  ];
}

export function resolveCanonicalModelBounds(
  metadata: ModelMetadata,
  query: ModelBoundsQuery,
): ResolvedModelBounds {
  const bounds = metadata.currentLocalBounds ?? metadata.localBounds;
  const scale = query.scale ?? 1;
  const heading = query.heading ?? 0;
  const pitch = query.pitch ?? 0;
  const roll = query.roll ?? 0;
  const anchorZ = query.anchorZ ?? 0;
  const [originLon, originLat, originAlt] = query.coordinates;
  const [originX, originY] = lonLatToMercator(originLon, originLat);

  const cornersLonLatAlt = getOrderedBoundsCorners(bounds).map((corner) => {
    const [east, north, up] = rotateLocalOffset(
      corner[0] * scale,
      corner[1] * scale,
      corner[2] * scale,
      heading,
      pitch,
      roll,
    );
    const [lon, lat] = mercatorToLonLat(originX + east, originY + north);
    return [lon, lat, originAlt + anchorZ + up] as [number, number, number];
  });

  const aabbLonLatAlt = createEmptyBounds();
  for (const corner of cornersLonLatAlt) {
    expandBounds(aabbLonLatAlt, corner);
  }

  const footprint = [0, 1, 2, 3, 0].map((index) => cornersLonLatAlt[index]!);
  const topOutline = [4, 5, 6, 7, 4].map((index) => cornersLonLatAlt[index]!);

  return {
    cornersLonLatAlt,
    aabbLonLatAlt: finalizeBounds(aabbLonLatAlt),
    footprint,
    topOutline,
  };
}
