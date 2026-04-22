use wasm_bindgen::prelude::*;

/// Generate terrain grid vertices with UV coordinates and skirt geometry.
///
/// # Arguments
/// * `resolution` - Number of cells per side (e.g. 32 → 33×33 inner vertices)
///
/// # Returns
/// Flat `f32` array: `[u0, v0, isSkirt0, u1, v1, isSkirt1, ...]`
/// - Grid vertices: `(resolution+1)^2` with `isSkirt = 0.0`
/// - Skirt vertices: `4 * (resolution+1)` with `isSkirt = 1.0`
#[wasm_bindgen]
pub fn generate_terrain_vertices(resolution: u32) -> Vec<f32> {
    let n = (resolution + 1) as usize;
    let grid_count = n * n;
    let skirt_count = 4 * n;
    let total = grid_count + skirt_count;
    let mut out = Vec::with_capacity(total * 3);

    // Main grid vertices
    for y in 0..n {
        for x in 0..n {
            let u = x as f32 / resolution as f32;
            let v = y as f32 / resolution as f32;
            out.push(u);
            out.push(v);
            out.push(0.0); // isSkirt = 0
        }
    }

    // Skirt vertices — duplicate edge vertices with isSkirt = 1
    // Bottom edge (y = 0)
    for x in 0..n {
        let u = x as f32 / resolution as f32;
        out.push(u);
        out.push(0.0);
        out.push(1.0);
    }
    // Top edge (y = resolution)
    for x in 0..n {
        let u = x as f32 / resolution as f32;
        out.push(u);
        out.push(1.0);
        out.push(1.0);
    }
    // Left edge (x = 0)
    for y in 0..n {
        let v = y as f32 / resolution as f32;
        out.push(0.0);
        out.push(v);
        out.push(1.0);
    }
    // Right edge (x = resolution)
    for y in 0..n {
        let v = y as f32 / resolution as f32;
        out.push(1.0);
        out.push(v);
        out.push(1.0);
    }

    out
}

/// Generate terrain grid triangle indices (main grid + skirt geometry).
///
/// # Arguments
/// * `resolution` - Number of cells per side (must match `generate_terrain_vertices`)
///
/// # Returns
/// Flat `u32` index array for triangle list rendering.
/// - Grid: `resolution^2 * 6` indices (2 triangles per cell)
/// - Skirt: `4 * resolution * 6` indices (2 triangles per skirt segment)
#[wasm_bindgen]
pub fn generate_terrain_indices(resolution: u32) -> Vec<u32> {
    let n = (resolution + 1) as u32;
    let grid_indices = (resolution * resolution * 6) as usize;
    let skirt_indices = (4 * resolution * 6) as usize;
    let mut out = Vec::with_capacity(grid_indices + skirt_indices);

    // Main grid triangles
    for y in 0..resolution {
        for x in 0..resolution {
            let tl = y * n + x;
            let tr = tl + 1;
            let bl = (y + 1) * n + x;
            let br = bl + 1;

            // Triangle 1 (top-left)
            out.push(tl);
            out.push(bl);
            out.push(tr);

            // Triangle 2 (bottom-right)
            out.push(tr);
            out.push(bl);
            out.push(br);
        }
    }

    // Skirt indices — connect grid edge vertices to skirt vertices
    let grid_count = n * n;

    // Bottom edge skirt: grid row 0 → skirt bottom (offset 0)
    let skirt_bottom = grid_count;
    for x in 0..resolution {
        let g0 = x;                     // grid vertex
        let g1 = x + 1;                 // grid vertex next
        let s0 = skirt_bottom + x;      // skirt vertex
        let s1 = skirt_bottom + x + 1;  // skirt vertex next

        // Skirt hangs below → triangle winding faces outward
        out.push(s0);
        out.push(s1);
        out.push(g0);

        out.push(g0);
        out.push(s1);
        out.push(g1);
    }

    // Top edge skirt: grid row = resolution → skirt top (offset n)
    let skirt_top = grid_count + n;
    for x in 0..resolution {
        let g0 = resolution * n + x;
        let g1 = g0 + 1;
        let s0 = skirt_top + x;
        let s1 = skirt_top + x + 1;

        out.push(g0);
        out.push(g1);
        out.push(s0);

        out.push(s0);
        out.push(g1);
        out.push(s1);
    }

    // Left edge skirt: grid col 0 → skirt left (offset 2*n)
    let skirt_left = grid_count + 2 * n;
    for y in 0..resolution {
        let g0 = y * n;
        let g1 = (y + 1) * n;
        let s0 = skirt_left + y;
        let s1 = skirt_left + y + 1;

        out.push(g0);
        out.push(g1);
        out.push(s0);

        out.push(s0);
        out.push(g1);
        out.push(s1);
    }

    // Right edge skirt: grid col = resolution → skirt right (offset 3*n)
    let skirt_right = grid_count + 3 * n;
    for y in 0..resolution {
        let g0 = y * n + resolution;
        let g1 = (y + 1) * n + resolution;
        let s0 = skirt_right + y;
        let s1 = skirt_right + y + 1;

        out.push(s0);
        out.push(s1);
        out.push(g0);

        out.push(g0);
        out.push(s1);
        out.push(g1);
    }

    out
}

/// Compute an RGB8 normal map from an elevation grid using Horn's method.
///
/// # Arguments
/// * `elevations` - Row-major f32 elevation grid
/// * `width`      - Grid width (columns)
/// * `height`     - Grid height (rows)
/// * `cell_size_x` - Horizontal distance between cells (meters)
/// * `cell_size_y` - Vertical distance between cells (meters)
///
/// # Returns
/// `Vec<u8>` of length `width * height * 3` (RGB8).
/// Normal encoding: `(nx * 127 + 128, ny * 127 + 128, nz * 127 + 128)`
#[wasm_bindgen]
pub fn compute_normal_map(
    elevations: &[f32],
    width: u32,
    height: u32,
    cell_size_x: f64,
    cell_size_y: f64,
) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let mut result = vec![0u8; w * h * 3];

    for y in 0..h {
        for x in 0..w {
            let idx = y * w + x;
            let e = elevations[idx];

            // NaN elevations → default up-normal (0, 0, 1) → (128, 128, 255)
            if e.is_nan() {
                result[idx * 3] = 128;
                result[idx * 3 + 1] = 128;
                result[idx * 3 + 2] = 255;
                continue;
            }

            // 3×3 neighborhood with clamped edge lookups (Horn's numbering)
            //  a  b  c
            //  d  e  f
            //  g  h  i
            let xm = if x > 0 { x - 1 } else { 0 };
            let xp = if x < w - 1 { x + 1 } else { w - 1 };
            let ym = if y > 0 { y - 1 } else { 0 };
            let yp = if y < h - 1 { y + 1 } else { h - 1 };

            let a = safe_elev(elevations, w, xm, ym);
            let b = safe_elev(elevations, w, x, ym);
            let c = safe_elev(elevations, w, xp, ym);
            let d = safe_elev(elevations, w, xm, y);
            let f = safe_elev(elevations, w, xp, y);
            let g = safe_elev(elevations, w, xm, yp);
            let h_val = safe_elev(elevations, w, x, yp);
            let i = safe_elev(elevations, w, xp, yp);

            // Horn's finite differences
            let dzdx = ((c + 2.0 * f + i) - (a + 2.0 * d + g)) / (8.0 * cell_size_x);
            let dzdy = ((g + 2.0 * h_val + i) - (a + 2.0 * b + c)) / (8.0 * cell_size_y);

            // Surface normal = normalize(-dzdx, -dzdy, 1)
            let nx = -dzdx;
            let ny = -dzdy;
            let nz = 1.0_f64;
            let len = (nx * nx + ny * ny + nz * nz).sqrt();
            let nx = nx / len;
            let ny = ny / len;
            let nz = nz / len;

            // Encode to RGB8
            result[idx * 3] = encode_normal_component(nx);
            result[idx * 3 + 1] = encode_normal_component(ny);
            result[idx * 3 + 2] = encode_normal_component(nz);
        }
    }

    result
}

/// Safely read an elevation value, returning 0.0 for NaN.
#[inline]
fn safe_elev(data: &[f32], width: usize, x: usize, y: usize) -> f64 {
    let val = data[y * width + x];
    if val.is_nan() { 0.0 } else { val as f64 }
}

/// Encode a normal component from [-1, 1] to [0, 255].
#[inline]
fn encode_normal_component(n: f64) -> u8 {
    (n * 127.0 + 128.0).round().clamp(0.0, 255.0) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vertex_count() {
        let res = 32u32;
        let verts = generate_terrain_vertices(res);
        let n = (res + 1) as usize;
        let expected_grid = n * n;
        let expected_skirt = 4 * n;
        let expected_total = expected_grid + expected_skirt;
        // Each vertex has 3 floats (u, v, isSkirt)
        assert_eq!(verts.len(), expected_total * 3);
    }

    #[test]
    fn test_index_count() {
        let res = 32u32;
        let indices = generate_terrain_indices(res);
        let grid_indices = (res * res * 6) as usize;
        let skirt_indices = (4 * res * 6) as usize;
        assert_eq!(indices.len(), grid_indices + skirt_indices);
    }

    #[test]
    fn test_vertex_uv_range() {
        let res = 4u32;
        let verts = generate_terrain_vertices(res);
        // Check all UV values are in [0, 1]
        for i in (0..verts.len()).step_by(3) {
            let u = verts[i];
            let v = verts[i + 1];
            assert!(u >= 0.0 && u <= 1.0, "u out of range: {}", u);
            assert!(v >= 0.0 && v <= 1.0, "v out of range: {}", v);
        }
    }

    #[test]
    fn test_skirt_flag() {
        let res = 4u32;
        let verts = generate_terrain_vertices(res);
        let n = (res + 1) as usize;
        let grid_count = n * n;

        // Grid vertices should have isSkirt = 0
        for i in 0..grid_count {
            assert_eq!(verts[i * 3 + 2], 0.0, "Grid vertex {} should have isSkirt=0", i);
        }

        // Skirt vertices should have isSkirt = 1
        for i in grid_count..(grid_count + 4 * n) {
            assert_eq!(verts[i * 3 + 2], 1.0, "Skirt vertex {} should have isSkirt=1", i);
        }
    }

    #[test]
    fn test_indices_in_bounds() {
        let res = 8u32;
        let verts = generate_terrain_vertices(res);
        let indices = generate_terrain_indices(res);
        let vertex_count = (verts.len() / 3) as u32;

        for (i, &idx) in indices.iter().enumerate() {
            assert!(
                idx < vertex_count,
                "Index {} at position {} exceeds vertex count {}",
                idx, i, vertex_count
            );
        }
    }

    #[test]
    fn test_normal_map_flat_terrain() {
        // Flat terrain → all normals should point up: (0, 0, 1) → (128, 128, 255)
        let w = 8u32;
        let h = 8u32;
        let elevations = vec![100.0f32; (w * h) as usize];

        let result = compute_normal_map(&elevations, w, h, 30.0, 30.0);
        assert_eq!(result.len(), (w * h * 3) as usize);

        for y in 0..h as usize {
            for x in 0..w as usize {
                let idx = (y * w as usize + x) * 3;
                assert_eq!(result[idx], 128, "nx at ({},{}) should be 128", x, y);
                assert_eq!(result[idx + 1], 128, "ny at ({},{}) should be 128", x, y);
                assert_eq!(result[idx + 2], 255, "nz at ({},{}) should be 255", x, y);
            }
        }
    }

    #[test]
    fn test_normal_map_nan_elevation() {
        let w = 3u32;
        let h = 3u32;
        let mut elevations = vec![100.0f32; (w * h) as usize];
        elevations[4] = f32::NAN; // Center pixel

        let result = compute_normal_map(&elevations, w, h, 30.0, 30.0);

        // NaN pixel → default up-normal
        assert_eq!(result[4 * 3], 128);
        assert_eq!(result[4 * 3 + 1], 128);
        assert_eq!(result[4 * 3 + 2], 255);
    }

    #[test]
    fn test_normal_map_slope() {
        // West-to-east slope: elevation increases with x
        let w = 8u32;
        let h = 8u32;
        let mut elevations = vec![0.0f32; (w * h) as usize];
        for y in 0..h as usize {
            for x in 0..w as usize {
                elevations[y * w as usize + x] = (x * 100) as f32;
            }
        }

        let result = compute_normal_map(&elevations, w, h, 30.0, 30.0);

        // Interior pixels should have nx < 128 (normal tilts west, opposing the slope)
        for y in 1..(h - 1) as usize {
            for x in 1..(w - 1) as usize {
                let idx = (y * w as usize + x) * 3;
                let nx = result[idx];
                assert!(
                    nx < 128,
                    "Expected nx < 128 for east slope at ({},{}), got {}",
                    x, y, nx
                );
                // ny should remain ~128 (no north-south slope)
                let ny = result[idx + 1];
                assert!(
                    (ny as i32 - 128).unsigned_abs() < 5,
                    "Expected ny ≈ 128 at ({},{}), got {}",
                    x, y, ny
                );
            }
        }
    }

    #[test]
    fn test_normal_map_output_length() {
        let w = 16u32;
        let h = 12u32;
        let elevations = vec![0.0f32; (w * h) as usize];
        let result = compute_normal_map(&elevations, w, h, 1.0, 1.0);
        assert_eq!(result.len(), (w * h * 3) as usize);
    }

    #[test]
    fn test_small_resolution() {
        // Minimum useful resolution = 1 → 2×2 grid + 8 skirt vertices
        let verts = generate_terrain_vertices(1);
        assert_eq!(verts.len(), (4 + 8) * 3); // 4 grid + 8 skirt

        let indices = generate_terrain_indices(1);
        assert_eq!(indices.len(), 6 + 4 * 6); // 1 cell * 6 + 4 edges * 1 seg * 6
    }
}
