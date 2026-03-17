use wasm_bindgen::prelude::*;

// ─── Line Tessellation (GPU-ready triangle strip) ───

/// Result of line tessellation: positions, normals, and UV coordinates
/// for GPU-ready rendering with screen-space width.
#[wasm_bindgen]
pub struct TessellatedLineResult {
    /// Triangle vertex positions: [x0, y0, x1, y1, ...]
    positions: Vec<f32>,
    /// Extrusion normals per vertex: [nx0, ny0, nx1, ny1, ...]
    normals: Vec<f32>,
    /// UV coordinates per vertex: [u0, v0, u1, v1, ...] (u = along line, v = across)
    uvs: Vec<f32>,
    /// Triangle indices
    indices: Vec<u32>,
}

#[wasm_bindgen]
impl TessellatedLineResult {
    #[wasm_bindgen(getter)]
    pub fn positions(&self) -> Vec<f32> {
        self.positions.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn normals(&self) -> Vec<f32> {
        self.normals.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn uvs(&self) -> Vec<f32> {
        self.uvs.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn indices(&self) -> Vec<u32> {
        self.indices.clone()
    }
}

const MITER_LIMIT: f32 = 2.0; // Fallback to bevel when miter exceeds this

fn vec2_len(x: f32, y: f32) -> f32 {
    (x * x + y * y).sqrt()
}

fn vec2_normalize(x: f32, y: f32) -> (f32, f32) {
    let len = vec2_len(x, y);
    if len < 1e-10 {
        (0.0, 0.0)
    } else {
        (x / len, y / len)
    }
}

/// Internal implementation: tessellate a single polyline segment.
/// Returns (positions, normals, uvs, indices) for a single line.
fn tessellate_single_line(
    coords: &[f64],
    line_width: f32,
    vertex_offset: u32,
) -> (Vec<f32>, Vec<f32>, Vec<f32>, Vec<u32>) {
    let n = coords.len() / 2;
    if n < 2 {
        return (vec![], vec![], vec![], vec![]);
    }

    let half_w = line_width * 0.5;
    let mut positions = Vec::with_capacity(n * 4);
    let mut normals = Vec::with_capacity(n * 4);
    let mut uvs = Vec::with_capacity(n * 4);
    let mut indices = Vec::new();

    // Accumulate distance along the line for UV.u
    let mut accumulated_dist: f32 = 0.0;

    for i in 0..n {
        let px = coords[i * 2] as f32;
        let py = coords[i * 2 + 1] as f32;

        // Compute tangent direction
        let (dx_prev, dy_prev) = if i > 0 {
            let ppx = coords[(i - 1) * 2] as f32;
            let ppy = coords[(i - 1) * 2 + 1] as f32;
            vec2_normalize(px - ppx, py - ppy)
        } else {
            (0.0, 0.0)
        };

        let (dx_next, dy_next) = if i < n - 1 {
            let npx = coords[(i + 1) * 2] as f32;
            let npy = coords[(i + 1) * 2 + 1] as f32;
            vec2_normalize(npx - px, npy - py)
        } else {
            (0.0, 0.0)
        };

        // Tangent is average of prev and next directions
        let (tx, ty) = if i == 0 {
            (dx_next, dy_next)
        } else if i == n - 1 {
            (dx_prev, dy_prev)
        } else {
            vec2_normalize(dx_prev + dx_next, dy_prev + dy_next)
        };

        // Normal is perpendicular to tangent
        let (mut nx, mut ny) = (-ty, tx);

        // Miter join: adjust normal length for sharp angles
        let mut miter_scale: f32 = 1.0;
        if i > 0 && i < n - 1 {
            // Compute the miter vector using the bisector of the two edge normals
            let n1x = -dy_prev;
            let n1y = dx_prev;
            let n2x = -dy_next;
            let n2y = dx_next;

            let (bx, by) = vec2_normalize(n1x + n2x, n1y + n2y);
            let dot = bx * n1x + by * n1y;

            if dot.abs() > 1e-6 {
                miter_scale = 1.0 / dot;
                if miter_scale.abs() > MITER_LIMIT {
                    // Bevel fallback: just use the segment normal
                    miter_scale = 1.0;
                } else {
                    nx = bx;
                    ny = by;
                }
            }
        }

        // Accumulate distance
        if i > 0 {
            let ppx = coords[(i - 1) * 2] as f32;
            let ppy = coords[(i - 1) * 2 + 1] as f32;
            accumulated_dist += vec2_len(px - ppx, py - ppy);
        }

        let extrusion = half_w * miter_scale;

        // Vertex A (left side, v=0)
        positions.push(px);
        positions.push(py);
        normals.push(nx * extrusion);
        normals.push(ny * extrusion);
        uvs.push(accumulated_dist);
        uvs.push(0.0);

        // Vertex B (right side, v=1)
        positions.push(px);
        positions.push(py);
        normals.push(-nx * extrusion);
        normals.push(-ny * extrusion);
        uvs.push(accumulated_dist);
        uvs.push(1.0);
    }

    // Generate triangle indices (triangle strip as indexed triangles)
    for i in 0..(n - 1) as u32 {
        let base = vertex_offset + i * 2;
        // Triangle 1: A[i], B[i], A[i+1]
        indices.push(base);
        indices.push(base + 1);
        indices.push(base + 2);
        // Triangle 2: B[i], B[i+1], A[i+1]
        indices.push(base + 1);
        indices.push(base + 3);
        indices.push(base + 2);
    }

    (positions, normals, uvs, indices)
}

/// Internal implementation returning a native Result (testable on all targets).
pub(crate) fn tessellate_lines_impl(
    positions: &[f64],
    offsets: &[u32],
    line_width: f32,
) -> Result<TessellatedLineResult, String> {
    if line_width <= 0.0 {
        return Err("tessellate_lines: line_width must be positive".into());
    }
    if positions.len() % 2 != 0 {
        return Err("tessellate_lines: positions length must be even (2D coordinates)".into());
    }

    // If no offsets provided, treat the whole positions array as one line
    let effective_offsets: Vec<u32> = if offsets.is_empty() {
        vec![0, positions.len() as u32 / 2]
    } else {
        offsets.to_vec()
    };

    if effective_offsets.len() < 2 {
        return Err("tessellate_lines: offsets must have at least 2 values (start and end)".into());
    }

    let mut all_positions = Vec::new();
    let mut all_normals = Vec::new();
    let mut all_uvs = Vec::new();
    let mut all_indices = Vec::new();
    let mut vertex_offset: u32 = 0;

    for i in 0..effective_offsets.len() - 1 {
        let start = effective_offsets[i] as usize * 2;
        let end = effective_offsets[i + 1] as usize * 2;

        if start > positions.len() || end > positions.len() || start >= end {
            continue; // Skip invalid segments
        }

        let line_coords = &positions[start..end];
        let (pos, norm, uv, idx) =
            tessellate_single_line(line_coords, line_width, vertex_offset);

        vertex_offset += (pos.len() / 2) as u32;

        all_positions.extend(pos);
        all_normals.extend(norm);
        all_uvs.extend(uv);
        all_indices.extend(idx);
    }

    Ok(TessellatedLineResult {
        positions: all_positions,
        normals: all_normals,
        uvs: all_uvs,
        indices: all_indices,
    })
}

/// Tessellate polylines into GPU-ready triangle geometry.
///
/// `positions`: flat coordinate array [x0, y0, x1, y1, ...]
/// `offsets`: vertex-count offsets for multi-line boundaries [0, n1, n1+n2, ...]
///   If empty, the entire positions array is treated as a single line.
/// `line_width`: desired line width in coordinate units
///
/// Returns TessellatedLineResult with vertex positions, extrusion normals, UVs, and indices.
#[wasm_bindgen]
pub fn tessellate_lines(
    positions: &[f64],
    offsets: &[u32],
    line_width: f32,
) -> Result<TessellatedLineResult, JsValue> {
    tessellate_lines_impl(positions, offsets, line_width).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_two_point_line() {
        // Horizontal line from (0,0) to (10,0)
        let positions = vec![0.0, 0.0, 10.0, 0.0];
        let result = tessellate_lines_impl(&positions, &[], 2.0).unwrap();

        // 2 points -> 4 vertices (2 per point)
        assert_eq!(result.positions.len(), 8); // 4 vertices * 2 coords
        assert_eq!(result.normals.len(), 8);
        assert_eq!(result.uvs.len(), 8);
        // 1 segment -> 2 triangles -> 6 indices
        assert_eq!(result.indices.len(), 6);

        // Normals should point up and down (perpendicular to horizontal line)
        // For a horizontal line going right, normal is (0, 1) and (0, -1)
        let ny0 = result.normals[1]; // First vertex normal Y
        let ny1 = result.normals[3]; // Second vertex normal Y
        assert!((ny0.abs() - 1.0).abs() < 0.01, "Normal Y should be ~1.0, got {}", ny0);
        assert!((ny0 + ny1).abs() < 0.01, "Normals should be opposite");
    }

    #[test]
    fn test_multi_segment_line() {
        // L-shaped line: (0,0) -> (10,0) -> (10,10)
        let positions = vec![0.0, 0.0, 10.0, 0.0, 10.0, 10.0];
        let result = tessellate_lines_impl(&positions, &[], 2.0).unwrap();

        // 3 points -> 6 vertices
        assert_eq!(result.positions.len(), 12);
        // 2 segments -> 4 triangles -> 12 indices
        assert_eq!(result.indices.len(), 12);

        // UV accumulation: first point u=0, last point u > 0
        assert_eq!(result.uvs[0], 0.0); // u of first vertex
        assert!(result.uvs[8] > 0.0); // u of last vertex (should be ~20.0)
    }

    #[test]
    fn test_multi_line_with_offsets() {
        // Two separate lines:
        // Line 1: (0,0) -> (5,0) (2 points starting at vertex index 0)
        // Line 2: (10,10) -> (20,10) (2 points starting at vertex index 2)
        let positions = vec![0.0, 0.0, 5.0, 0.0, 10.0, 10.0, 20.0, 10.0];
        let offsets = vec![0u32, 2, 4]; // vertex count boundaries

        let result = tessellate_lines_impl(&positions, &offsets, 1.0).unwrap();

        // 2 lines * 2 points each = 4 points -> 8 vertices
        assert_eq!(result.positions.len(), 16);
        // 2 lines * 1 segment each * 2 triangles * 3 indices = 12
        assert_eq!(result.indices.len(), 12);
    }

    #[test]
    fn test_miter_join() {
        // Sharp angle: (0,0) -> (10,0) -> (10,10)
        let positions = vec![0.0, 0.0, 10.0, 0.0, 10.0, 10.0];
        let result = tessellate_lines_impl(&positions, &[], 4.0).unwrap();

        // Middle vertex should have miter join or bevel fallback
        // Just verify it produces valid geometry
        assert_eq!(result.positions.len(), 12); // 3 points * 2 vertices * 2 coords
        assert_eq!(result.indices.len(), 12); // 2 segments * 2 triangles * 3 indices

        // All indices should be valid
        let max_vertex = (result.positions.len() / 2) as u32;
        for &idx in &result.indices {
            assert!(idx < max_vertex, "Index {} out of range (max {})", idx, max_vertex);
        }
    }

    #[test]
    fn test_closed_ring() {
        // Square ring: (0,0) -> (10,0) -> (10,10) -> (0,10) -> (0,0)
        let positions = vec![0.0, 0.0, 10.0, 0.0, 10.0, 10.0, 0.0, 10.0, 0.0, 0.0];
        let result = tessellate_lines_impl(&positions, &[], 2.0).unwrap();

        // 5 points -> 10 vertices
        assert_eq!(result.positions.len(), 20);
        // 4 segments -> 8 triangles -> 24 indices
        assert_eq!(result.indices.len(), 24);
    }

    #[test]
    fn test_empty_input() {
        let result = tessellate_lines_impl(&[], &[], 1.0).unwrap();
        assert!(result.positions.is_empty());
        assert!(result.indices.is_empty());
    }

    #[test]
    fn test_single_point_line() {
        // Single point — not enough for a line segment
        let positions = vec![5.0, 5.0];
        let result = tessellate_lines_impl(&positions, &[], 1.0).unwrap();
        assert!(result.positions.is_empty());
        assert!(result.indices.is_empty());
    }

    #[test]
    fn test_invalid_line_width() {
        let positions = vec![0.0, 0.0, 10.0, 0.0];
        let result = tessellate_lines_impl(&positions, &[], 0.0);
        assert!(result.is_err());
        let result = tessellate_lines_impl(&positions, &[], -1.0);
        assert!(result.is_err());
    }
}
