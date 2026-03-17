use wasm_bindgen::prelude::*;

// ─── Triangulation (earcut) ───

/// Result of polygon triangulation.
/// `vertices` are the original 2D positions [x0, y0, x1, y1, ...].
/// `indices` are triangle indices into the vertex array (every 3 form a triangle).
#[wasm_bindgen]
pub struct TriangulateResult {
    vertices: Vec<f64>,
    indices: Vec<u32>,
}

#[wasm_bindgen]
impl TriangulateResult {
    #[wasm_bindgen(getter)]
    pub fn vertices(&self) -> Vec<f64> {
        self.vertices.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn indices(&self) -> Vec<u32> {
        self.indices.clone()
    }
}

/// Internal implementation returning a native Result (testable on all targets).
pub(crate) fn triangulate_impl(
    vertices: &[f64],
    hole_indices: &[u32],
) -> Result<TriangulateResult, String> {
    if vertices.len() < 6 {
        return Err("triangulate: need at least 3 vertices (6 coordinates)".into());
    }
    if vertices.len() % 2 != 0 {
        return Err("triangulate: vertices length must be even (2D coordinates)".into());
    }

    let holes: Vec<usize> = hole_indices.iter().map(|&h| h as usize).collect();
    let indices_usize = earcutr::earcut(vertices, &holes, 2)
        .map_err(|e| format!("triangulate earcut error: {:?}", e))?;

    let indices: Vec<u32> = indices_usize.iter().map(|&i| i as u32).collect();

    Ok(TriangulateResult {
        vertices: vertices.to_vec(),
        indices,
    })
}

/// Triangulate a 2D polygon using the earcut algorithm.
///
/// `vertices`: flat coordinate array [x0, y0, x1, y1, ...]
/// `hole_indices`: indices into the vertex array (vertex index, not coord index)
///   where each hole ring starts. Empty slice means no holes.
///
/// Returns TriangulateResult with the original vertices and computed triangle indices.
#[wasm_bindgen]
pub fn triangulate(vertices: &[f64], hole_indices: &[u32]) -> Result<TriangulateResult, JsValue> {
    triangulate_impl(vertices, hole_indices).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_triangulate_simple_triangle() {
        // A triangle: 3 vertices -> should produce exactly 1 triangle (3 indices)
        let vertices = vec![0.0, 0.0, 1.0, 0.0, 0.5, 1.0];
        let result = triangulate_impl(&vertices, &[]).unwrap();
        assert_eq!(result.vertices.len(), 6);
        assert_eq!(result.indices.len(), 3);
        // All indices must be valid (0, 1, or 2)
        for &idx in &result.indices {
            assert!(idx < 3, "Index out of range: {}", idx);
        }
    }

    #[test]
    fn test_triangulate_square() {
        // A square: 4 vertices -> should produce 2 triangles (6 indices)
        let vertices = vec![0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
        let result = triangulate_impl(&vertices, &[]).unwrap();
        assert_eq!(result.vertices.len(), 8);
        assert_eq!(result.indices.len(), 6);
        for &idx in &result.indices {
            assert!(idx < 4, "Index out of range: {}", idx);
        }
    }

    #[test]
    fn test_triangulate_with_hole() {
        // Outer ring: large square
        // Inner ring (hole): smaller square
        let vertices = vec![
            // Outer ring (4 vertices, indices 0-3)
            0.0, 0.0, 10.0, 0.0, 10.0, 10.0, 0.0, 10.0,
            // Hole ring (4 vertices, indices 4-7)
            2.0, 2.0, 8.0, 2.0, 8.0, 8.0, 2.0, 8.0,
        ];
        let hole_indices = vec![4u32]; // hole starts at vertex index 4
        let result = triangulate_impl(&vertices, &hole_indices).unwrap();
        assert_eq!(result.vertices.len(), 16);
        // With a hole, we should get more triangles than without
        assert!(
            result.indices.len() >= 6,
            "Expected at least 6 indices, got {}",
            result.indices.len()
        );
        // All indices valid
        for &idx in &result.indices {
            assert!(idx < 8, "Index out of range: {}", idx);
        }
    }

    #[test]
    fn test_triangulate_too_few_vertices() {
        let vertices = vec![0.0, 0.0, 1.0, 1.0]; // Only 2 vertices
        let result = triangulate_impl(&vertices, &[]);
        assert!(result.is_err());
    }
}
