use wasm_bindgen::prelude::*;
use std::collections::HashMap;

// ─── Spatial Index (grid-based) ───

/// Opaque handle to a grid-based spatial index stored in WASM memory.
/// The index is kept alive as long as this handle exists.
#[wasm_bindgen]
pub struct GridIndex {
    /// cell_size used when building the index
    cell_size: f64,
    /// Map from grid cell key (col, row) -> list of point indices
    cells: HashMap<(i64, i64), Vec<u32>>,
    /// Total number of indexed points
    num_points: u32,
}

/// Internal implementation: build grid index, returns native Result.
pub(crate) fn build_grid_index_impl(
    points: &[f64],
    cell_size: f64,
) -> Result<GridIndex, String> {
    if points.len() % 2 != 0 {
        return Err("build_grid_index: points length must be even".into());
    }
    if cell_size <= 0.0 {
        return Err("build_grid_index: cell_size must be positive".into());
    }

    let num_points = (points.len() / 2) as u32;
    let mut cells: HashMap<(i64, i64), Vec<u32>> = HashMap::new();

    for i in 0..num_points as usize {
        let x = points[i * 2];
        let y = points[i * 2 + 1];
        let col = (x / cell_size).floor() as i64;
        let row = (y / cell_size).floor() as i64;
        cells.entry((col, row)).or_default().push(i as u32);
    }

    Ok(GridIndex {
        cell_size,
        cells,
        num_points,
    })
}

/// Internal implementation: query grid index, returns native Result.
pub(crate) fn query_grid_index_impl(
    index: &GridIndex,
    bbox: &[f64],
) -> Result<Vec<u32>, String> {
    if bbox.len() != 4 {
        return Err("query_grid_index: bbox must have 4 values [minX, minY, maxX, maxY]".into());
    }

    let min_x = bbox[0];
    let min_y = bbox[1];
    let max_x = bbox[2];
    let max_y = bbox[3];

    let col_min = (min_x / index.cell_size).floor() as i64;
    let col_max = (max_x / index.cell_size).floor() as i64;
    let row_min = (min_y / index.cell_size).floor() as i64;
    let row_max = (max_y / index.cell_size).floor() as i64;

    let mut result = Vec::new();

    for col in col_min..=col_max {
        for row in row_min..=row_max {
            if let Some(point_indices) = index.cells.get(&(col, row)) {
                result.extend(point_indices);
            }
        }
    }

    // Deduplicate (not strictly necessary with grid, but safe)
    result.sort_unstable();
    result.dedup();

    Ok(result)
}

/// Build a grid-based spatial index over 2D points.
///
/// `points`: flat coordinate array [x0, y0, x1, y1, ...]
/// `cell_size`: size of each grid cell (in the same coordinate units as points)
///
/// Returns a GridIndex handle that can be queried with `query_grid_index`.
#[wasm_bindgen]
pub fn build_grid_index(points: &[f64], cell_size: f64) -> Result<GridIndex, JsValue> {
    build_grid_index_impl(points, cell_size).map_err(|e| JsValue::from_str(&e))
}

/// Query the grid index for all points within a bounding box.
///
/// `index`: the GridIndex handle built with `build_grid_index`
/// `bbox`: [minX, minY, maxX, maxY]
///
/// Returns a Vec<u32> of point indices that fall within the bbox.
#[wasm_bindgen]
pub fn query_grid_index(index: &GridIndex, bbox: &[f64]) -> Result<Vec<u32>, JsValue> {
    query_grid_index_impl(index, bbox).map_err(|e| JsValue::from_str(&e))
}

/// Get the number of indexed points.
#[wasm_bindgen]
impl GridIndex {
    #[wasm_bindgen(getter)]
    pub fn num_points(&self) -> u32 {
        self.num_points
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_and_query_basic() {
        let points = vec![
            1.0, 1.0, // point 0
            5.0, 5.0, // point 1
            9.0, 9.0, // point 2
        ];
        let index = build_grid_index_impl(&points, 10.0).unwrap();
        assert_eq!(index.num_points, 3);

        // Query a bbox that covers all points
        let result = query_grid_index_impl(&index, &[0.0, 0.0, 10.0, 10.0]).unwrap();
        assert_eq!(result.len(), 3);
        assert!(result.contains(&0));
        assert!(result.contains(&1));
        assert!(result.contains(&2));
    }

    #[test]
    fn test_query_partial() {
        let points = vec![
            1.0, 1.0,   // point 0 -> cell (0, 0)
            15.0, 15.0,  // point 1 -> cell (1, 1)
            25.0, 25.0,  // point 2 -> cell (2, 2)
        ];
        let index = build_grid_index_impl(&points, 10.0).unwrap();

        // Query only the first cell
        let result = query_grid_index_impl(&index, &[0.0, 0.0, 9.9, 9.9]).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result.contains(&0));

        // Query covering first two cells
        let result = query_grid_index_impl(&index, &[0.0, 0.0, 19.9, 19.9]).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&0));
        assert!(result.contains(&1));
    }

    #[test]
    fn test_query_empty_area() {
        let points = vec![1.0, 1.0, 5.0, 5.0];
        let index = build_grid_index_impl(&points, 10.0).unwrap();

        // Query an area far from any points
        let result = query_grid_index_impl(&index, &[100.0, 100.0, 200.0, 200.0]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_negative_coordinates() {
        let points = vec![
            -5.0, -5.0, // point 0 -> cell (-1, -1)
            5.0, 5.0,   // point 1 -> cell (0, 0)
        ];
        let index = build_grid_index_impl(&points, 10.0).unwrap();

        // Query covering negative region
        let result = query_grid_index_impl(&index, &[-10.0, -10.0, 0.0, 0.0]).unwrap();
        assert!(result.contains(&0));

        // Query covering positive region
        let result = query_grid_index_impl(&index, &[0.0, 0.0, 10.0, 10.0]).unwrap();
        assert!(result.contains(&1));
    }
}
