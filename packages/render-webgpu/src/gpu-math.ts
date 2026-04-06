/**
 * GPU Math Utilities
 *
 * Matrix and vector operations shared across render engine delegates.
 */

/**
 * 4x4 matrix multiplication (column-major Float32Array).
 * result = a * b
 */
export function multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row]! * b[col * 4 + k]!;
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * 4x4 matrix inverse (column-major Float32Array).
 * Returns null when the matrix is singular.
 */
export function invertMat4(matrix: Float32Array): Float32Array | null {
  const out = new Float32Array(16);

  const a00 = matrix[0]!, a01 = matrix[1]!, a02 = matrix[2]!, a03 = matrix[3]!;
  const a10 = matrix[4]!, a11 = matrix[5]!, a12 = matrix[6]!, a13 = matrix[7]!;
  const a20 = matrix[8]!, a21 = matrix[9]!, a22 = matrix[10]!, a23 = matrix[11]!;
  const a30 = matrix[12]!, a31 = matrix[13]!, a32 = matrix[14]!, a33 = matrix[15]!;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(determinant) < 1e-8) {
    return null;
  }
  const invDet = 1.0 / determinant;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * invDet;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * invDet;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * invDet;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * invDet;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * invDet;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * invDet;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * invDet;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * invDet;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;

  return out;
}

/**
 * 4x4 translation matrix (column-major Float32Array).
 */
export function createTranslationMat4(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}
