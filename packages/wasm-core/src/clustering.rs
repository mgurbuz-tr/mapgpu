use wasm_bindgen::prelude::*;

// ─── Clustering (grid-based) ───

/// Result of grid-based point clustering.
#[wasm_bindgen]
pub struct ClusterResult {
    centroids: Vec<f64>,
    counts: Vec<u32>,
    assignments: Vec<i32>,
}

#[wasm_bindgen]
impl ClusterResult {
    /// Cluster centroid positions: [x0, y0, x1, y1, ...]
    #[wasm_bindgen(getter)]
    pub fn centroids(&self) -> Vec<f64> {
        self.centroids.clone()
    }

    /// Number of points in each cluster
    #[wasm_bindgen(getter)]
    pub fn counts(&self) -> Vec<u32> {
        self.counts.clone()
    }

    /// Cluster assignment for each input point (cluster index)
    #[wasm_bindgen(getter)]
    pub fn assignments(&self) -> Vec<i32> {
        self.assignments.clone()
    }
}

/// Internal implementation returning native Result (testable on all targets).
pub(crate) fn cluster_points_impl(
    points: &[f64],
    radius: f64,
    extent: &[f64],
    zoom: u32,
) -> Result<ClusterResult, String> {
    if points.len() % 2 != 0 {
        return Err("cluster_points: points length must be even".into());
    }
    if extent.len() != 4 {
        return Err("cluster_points: extent must have 4 values [minX, minY, maxX, maxY]".into());
    }
    if radius <= 0.0 {
        return Err("cluster_points: radius must be positive".into());
    }

    let num_points = points.len() / 2;
    if num_points == 0 {
        return Ok(ClusterResult {
            centroids: vec![],
            counts: vec![],
            assignments: vec![],
        });
    }

    let min_x = extent[0];
    let min_y = extent[1];
    let max_x = extent[2];
    let max_y = extent[3];

    let extent_width = max_x - min_x;
    let extent_height = max_y - min_y;
    if extent_width <= 0.0 || extent_height <= 0.0 {
        return Err("cluster_points: extent must have positive width and height".into());
    }

    // Cell size scales with zoom: at higher zoom, cells are smaller in world coords
    let scale = 2.0_f64.powi(zoom as i32);
    let cell_size = radius / scale;

    if cell_size <= 0.0 {
        return Err("cluster_points: computed cell_size is non-positive".into());
    }

    // Number of grid columns and rows
    let cols = ((extent_width / cell_size).ceil() as usize).max(1);
    let rows = ((extent_height / cell_size).ceil() as usize).max(1);

    // Map from grid cell key -> (sum_x, sum_y, count, cluster_id)
    use std::collections::HashMap;
    let mut cell_map: HashMap<(usize, usize), (f64, f64, u32, usize)> = HashMap::new();
    let mut assignments = vec![0i32; num_points];
    let mut next_cluster_id: usize = 0;

    for i in 0..num_points {
        let x = points[i * 2];
        let y = points[i * 2 + 1];

        // Grid cell for this point
        let col = if x >= max_x {
            cols - 1
        } else {
            ((x - min_x) / cell_size) as usize
        };
        let row = if y >= max_y {
            rows - 1
        } else {
            ((y - min_y) / cell_size) as usize
        };

        let col = col.min(cols - 1);
        let row = row.min(rows - 1);

        let entry = cell_map.entry((col, row)).or_insert_with(|| {
            let id = next_cluster_id;
            next_cluster_id += 1;
            (0.0, 0.0, 0, id)
        });
        entry.0 += x;
        entry.1 += y;
        entry.2 += 1;
        assignments[i] = entry.3 as i32;
    }

    // Build output arrays
    let num_clusters = next_cluster_id;
    let mut centroids = vec![0.0_f64; num_clusters * 2];
    let mut counts = vec![0u32; num_clusters];

    for (_, (sum_x, sum_y, count, cluster_id)) in &cell_map {
        let c = *count as f64;
        centroids[cluster_id * 2] = sum_x / c;
        centroids[cluster_id * 2 + 1] = sum_y / c;
        counts[*cluster_id] = *count;
    }

    Ok(ClusterResult {
        centroids,
        counts,
        assignments,
    })
}

/// Grid-based point clustering.
///
/// `points`: flat coordinate array [x0, y0, x1, y1, ...]
/// `radius`: clustering radius in pixels
/// `extent`: map extent [minX, minY, maxX, maxY]
/// `zoom`: current zoom level
///
/// The algorithm divides the extent into grid cells of size `radius / 2^zoom` and
/// groups points falling into the same cell. The centroid of each cluster
/// is the average position of its member points.
#[wasm_bindgen]
pub fn cluster_points(
    points: &[f64],
    radius: f64,
    extent: &[f64],
    zoom: u32,
) -> Result<ClusterResult, JsValue> {
    cluster_points_impl(points, radius, extent, zoom).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cluster_single_cell() {
        // All points very close -> should form 1 cluster
        let points = vec![1.0, 1.0, 1.1, 1.1, 1.05, 1.05];
        let extent = vec![0.0, 0.0, 100.0, 100.0];
        let result = cluster_points_impl(&points, 50.0, &extent, 0).unwrap();
        // With cell_size = 50.0 / 1 = 50.0, all points in same cell
        assert_eq!(result.counts.len(), 1);
        assert_eq!(result.counts[0], 3);
        assert_eq!(result.assignments, vec![0, 0, 0]);
        // Centroid is average
        let expected_cx = (1.0 + 1.1 + 1.05) / 3.0;
        let expected_cy = (1.0 + 1.1 + 1.05) / 3.0;
        assert!((result.centroids[0] - expected_cx).abs() < 1e-10);
        assert!((result.centroids[1] - expected_cy).abs() < 1e-10);
    }

    #[test]
    fn test_cluster_multiple_cells() {
        // Two groups of points far apart
        let points = vec![
            0.0, 0.0, 0.1, 0.1, // group 1
            90.0, 90.0, 90.1, 90.1, // group 2
        ];
        let extent = vec![0.0, 0.0, 100.0, 100.0];
        // cell_size = 10.0 / 1 = 10.0 -> group 1 in cell (0,0), group 2 in cell (9,9)
        let result = cluster_points_impl(&points, 10.0, &extent, 0).unwrap();
        assert_eq!(result.counts.len(), 2);
        // Both clusters have 2 points
        let mut sorted_counts: Vec<u32> = result.counts.clone();
        sorted_counts.sort();
        assert_eq!(sorted_counts, vec![2, 2]);
        // Assignments: first two in same cluster, last two in same cluster
        assert_eq!(result.assignments[0], result.assignments[1]);
        assert_eq!(result.assignments[2], result.assignments[3]);
        assert_ne!(result.assignments[0], result.assignments[2]);
    }

    #[test]
    fn test_cluster_empty_input() {
        let points: Vec<f64> = vec![];
        let extent = vec![0.0, 0.0, 100.0, 100.0];
        let result = cluster_points_impl(&points, 10.0, &extent, 0).unwrap();
        assert!(result.centroids.is_empty());
        assert!(result.counts.is_empty());
        assert!(result.assignments.is_empty());
    }

    #[test]
    fn test_cluster_zoom_affects_cell_size() {
        // At zoom 0, cell_size = radius / 1 = 100 -> all in one cell
        // At zoom 4, cell_size = radius / 16 = 6.25 -> potentially different cells
        let points = vec![10.0, 10.0, 50.0, 50.0];
        let extent = vec![0.0, 0.0, 100.0, 100.0];

        let result_z0 = cluster_points_impl(&points, 100.0, &extent, 0).unwrap();
        let result_z4 = cluster_points_impl(&points, 100.0, &extent, 4).unwrap();

        // At zoom 0: cell_size=100, all fit in one cell
        assert_eq!(result_z0.counts.len(), 1);
        // At zoom 4: cell_size=6.25, points are in different cells
        assert_eq!(result_z4.counts.len(), 2);
    }
}
