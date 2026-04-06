use wasm_bindgen::prelude::*;

// ─── LOS Computation (elevation comparison) ───

/// Result of Line-of-Sight computation.
#[wasm_bindgen]
pub struct LosResult {
    /// Whether the target is visible from the observer
    visible: bool,
    /// Blocking point coordinates [x, y, z] if not visible, empty otherwise
    blocking_point: Vec<f64>,
    /// Elevation profile: [distance0, elevation0, distance1, elevation1, ...]
    profile: Vec<f64>,
}

#[wasm_bindgen]
impl LosResult {
    #[wasm_bindgen(getter)]
    pub fn visible(&self) -> bool {
        self.visible
    }

    #[wasm_bindgen(getter)]
    pub fn blocking_point(&self) -> Vec<f64> {
        self.blocking_point.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn profile(&self) -> Vec<f64> {
        self.profile.clone()
    }
}

/// Earth radius for curvature correction (metres)
const EARTH_RADIUS_M: f64 = 6378137.0;

/// Compute earth curvature drop at a given distance from observer.
/// At distance d, the surface drops approximately d^2 / (2*R).
fn earth_curvature_drop(distance: f64) -> f64 {
    (distance * distance) / (2.0 * EARTH_RADIUS_M)
}

/// Internal implementation returning a native Result (testable on all targets).
///
/// `segments`: sample points [x0, y0, z0, x1, y1, z1, ...]
/// `elevations`: terrain elevation at each sample point [e0, e1, ...]
/// `observer_offset`: height offset added to observer's terrain elevation
/// `target_offset`: height offset added to target's terrain elevation
/// `use_curvature`: whether to apply earth curvature correction
pub(crate) fn compute_los_impl(
    segments: &[f64],
    elevations: &[f64],
    observer_offset: f64,
    target_offset: f64,
    use_curvature: bool,
) -> Result<LosResult, String> {
    if segments.len() % 3 != 0 {
        return Err("compute_los: segments length must be a multiple of 3 (x, y, z)".into());
    }

    let n = segments.len() / 3;
    if n == 0 {
        return Err("compute_los: segments must not be empty".into());
    }

    if elevations.len() != n {
        return Err(format!(
            "compute_los: elevations length ({}) must match segment point count ({})",
            elevations.len(),
            n
        ));
    }

    // Handle trivial case: observer == target (single point)
    if n == 1 {
        return Ok(LosResult {
            visible: true,
            blocking_point: vec![],
            profile: vec![0.0, elevations[0]],
        });
    }

    // Observer position
    let obs_x = segments[0];
    let obs_y = segments[1];
    let obs_elevation = elevations[0] + observer_offset;

    // Target position
    let tgt_x = segments[(n - 1) * 3];
    let tgt_y = segments[(n - 1) * 3 + 1];
    let tgt_elevation = elevations[n - 1] + target_offset;

    // Compute total horizontal distance from observer to target
    let total_dist = ((tgt_x - obs_x).powi(2) + (tgt_y - obs_y).powi(2)).sqrt();

    // Build profile and check LOS
    let mut profile = Vec::with_capacity(n * 2);
    let mut visible = true;
    let mut blocking_point: Vec<f64> = vec![];

    for i in 0..n {
        let sx = segments[i * 3];
        let sy = segments[i * 3 + 1];

        // Horizontal distance from observer to this sample
        let dist = ((sx - obs_x).powi(2) + (sy - obs_y).powi(2)).sqrt();

        let mut terrain_elev = elevations[i];

        // Apply curvature correction
        if use_curvature {
            terrain_elev += earth_curvature_drop(dist);
        }

        profile.push(dist);
        profile.push(terrain_elev);

        // Skip observer and target points for LOS check
        if i == 0 || i == n - 1 {
            continue;
        }

        if !visible {
            continue; // Already blocked, just build profile
        }

        // Interpolate the LOS line height at this distance
        let t = if total_dist > 1e-10 {
            dist / total_dist
        } else {
            0.0
        };
        let los_height = obs_elevation + t * (tgt_elevation - obs_elevation);

        // If terrain is above the LOS line, sight is blocked
        if terrain_elev > los_height {
            visible = false;
            blocking_point = vec![sx, sy, terrain_elev];
        }
    }

    Ok(LosResult {
        visible,
        blocking_point,
        profile,
    })
}

/// Compute Line-of-Sight between observer and target using terrain elevations.
///
/// `segments`: sample points between observer and target [x0,y0,z0, x1,y1,z1, ...]
/// `elevations`: terrain elevation at each sample point [e0, e1, ...]
/// `observer_offset`: additional height above terrain for observer
/// `target_offset`: additional height above terrain for target
///
/// Returns LosResult with visibility, optional blocking point, and elevation profile.
#[wasm_bindgen]
pub fn compute_los(
    segments: &[f64],
    elevations: &[f64],
    observer_offset: f64,
    target_offset: f64,
) -> Result<LosResult, JsValue> {
    compute_los_impl(segments, elevations, observer_offset, target_offset, false)
        .map_err(|e| JsValue::from_str(&e))
}

/// Compute Line-of-Sight with earth curvature correction.
#[wasm_bindgen]
pub fn compute_los_with_curvature(
    segments: &[f64],
    elevations: &[f64],
    observer_offset: f64,
    target_offset: f64,
) -> Result<LosResult, JsValue> {
    compute_los_impl(segments, elevations, observer_offset, target_offset, true)
        .map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clear_los() {
        // Flat terrain, observer and target at same elevation
        // Observer at (0,0,0), target at (100,0,0), 5 sample points
        let segments = vec![
            0.0, 0.0, 0.0,
            25.0, 0.0, 0.0,
            50.0, 0.0, 0.0,
            75.0, 0.0, 0.0,
            100.0, 0.0, 0.0,
        ];
        let elevations = vec![10.0, 10.0, 10.0, 10.0, 10.0]; // Flat terrain at 10m
        let result = compute_los_impl(&segments, &elevations, 2.0, 0.0, false).unwrap();

        assert!(result.visible);
        assert!(result.blocking_point.is_empty());
        assert_eq!(result.profile.len(), 10); // 5 points * 2 (distance, elevation)
        // First distance should be 0
        assert_eq!(result.profile[0], 0.0);
    }

    #[test]
    fn test_blocked_los() {
        // Hill in the middle blocks LOS
        // Observer at (0,0,0) with 2m offset, target at (100,0,0) at ground level
        let segments = vec![
            0.0, 0.0, 0.0,
            25.0, 0.0, 0.0,
            50.0, 0.0, 0.0,   // Hill here
            75.0, 0.0, 0.0,
            100.0, 0.0, 0.0,
        ];
        let elevations = vec![10.0, 10.0, 50.0, 10.0, 10.0]; // Hill at middle
        let result = compute_los_impl(&segments, &elevations, 2.0, 2.0, false).unwrap();

        assert!(!result.visible);
        assert_eq!(result.blocking_point.len(), 3);
        assert_eq!(result.blocking_point[0], 50.0); // x of blocking point
        assert_eq!(result.blocking_point[2], 50.0); // elevation of blocking point
    }

    #[test]
    fn test_observer_equals_target() {
        // Single point
        let segments = vec![10.0, 20.0, 30.0];
        let elevations = vec![100.0];
        let result = compute_los_impl(&segments, &elevations, 0.0, 0.0, false).unwrap();

        assert!(result.visible);
        assert!(result.blocking_point.is_empty());
        assert_eq!(result.profile.len(), 2); // 1 point * 2
    }

    #[test]
    fn test_two_point_los() {
        // Just observer and target, no intermediate samples
        let segments = vec![
            0.0, 0.0, 0.0,
            100.0, 0.0, 0.0,
        ];
        let elevations = vec![10.0, 10.0];
        let result = compute_los_impl(&segments, &elevations, 5.0, 0.0, false).unwrap();

        assert!(result.visible);
        assert_eq!(result.profile.len(), 4); // 2 points * 2
    }

    #[test]
    fn test_curvature_correction() {
        // At 10km distance, curvature drop is about 7.85m
        // Without curvature: flat terrain at 100m, observer at 100+2=102, target at 100+2=102
        //   LOS at midpoint = 102 > terrain 100 -> visible
        // With curvature: terrain at midpoint effectively raised by curvature drop
        let segments = vec![
            0.0, 0.0, 0.0,
            5000.0, 0.0, 0.0,
            10000.0, 0.0, 0.0,
        ];
        let elevations = vec![100.0, 100.0, 100.0];

        // Without curvature: visible
        let result_no_curv = compute_los_impl(&segments, &elevations, 2.0, 2.0, false).unwrap();
        assert!(result_no_curv.visible);

        // The curvature drop at 5km is ~1.96m, which won't block a 2m-offset observer
        // Let's use a scenario where curvature actually blocks
        // At 100km distance, curvature drop at 50km is ~196m
        let segments_long = vec![
            0.0, 0.0, 0.0,
            50000.0, 0.0, 0.0,
            100000.0, 0.0, 0.0,
        ];
        let elevations_long = vec![100.0, 100.0, 100.0];
        let result_curv = compute_los_impl(&segments_long, &elevations_long, 2.0, 2.0, true).unwrap();

        // Curvature drop at 50km ~ 50000^2 / (2*6378137) ~ 196m
        // Effective terrain at midpoint: 100 + 196 = 296
        // LOS height at midpoint: 102 (observer) + 0.5 * (102 - 102) = 102
        // 296 > 102 -> blocked
        assert!(!result_curv.visible);
    }

    #[test]
    fn test_profile_distances() {
        // Verify profile distances are computed correctly
        let segments = vec![
            0.0, 0.0, 0.0,
            3.0, 4.0, 0.0,  // distance = 5
            6.0, 8.0, 0.0,  // distance = 10
        ];
        let elevations = vec![0.0, 0.0, 0.0];
        let result = compute_los_impl(&segments, &elevations, 1.0, 1.0, false).unwrap();

        assert!((result.profile[0] - 0.0).abs() < 1e-10);
        assert!((result.profile[2] - 5.0).abs() < 1e-10);
        assert!((result.profile[4] - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_invalid_segments_length() {
        let segments = vec![1.0, 2.0]; // Not a multiple of 3
        let elevations = vec![0.0];
        let result = compute_los_impl(&segments, &elevations, 0.0, 0.0, false);
        assert!(result.is_err());
    }

    #[test]
    fn test_mismatched_elevations() {
        let segments = vec![0.0, 0.0, 0.0, 10.0, 0.0, 0.0];
        let elevations = vec![0.0]; // Should be 2, not 1
        let result = compute_los_impl(&segments, &elevations, 0.0, 0.0, false);
        assert!(result.is_err());
    }
}
