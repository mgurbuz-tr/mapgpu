use wasm_bindgen::prelude::*;
use std::f64::consts::PI;

pub mod triangulation;
pub mod clustering;
pub mod spatial_index;
pub mod geojson_parse;
pub mod line_tessellation;
pub mod los_compute;
pub mod binary_codec;
pub mod rtc;
pub mod hillshade;
pub mod terrain_mesh;
pub mod mvt_parse;

const EARTH_RADIUS: f64 = 6378137.0;
const MAX_LAT: f64 = 85.051128779806604;

// ─── Projection ───

/// WGS84 (lon, lat) → Web Mercator (x, y)
/// Input: interleaved [lon0, lat0, lon1, lat1, ...]
#[wasm_bindgen]
pub fn wgs84_to_mercator(coords: &[f64]) -> Vec<f64> {
    coords
        .chunks(2)
        .flat_map(|c| {
            let lon = c[0];
            let lat = c[1].clamp(-MAX_LAT, MAX_LAT);
            let x = lon * PI / 180.0 * EARTH_RADIUS;
            let y = ((lat * PI / 360.0 + PI / 4.0).tan()).ln() * EARTH_RADIUS;
            [x, y]
        })
        .collect()
}

/// Web Mercator (x, y) → WGS84 (lon, lat)
#[wasm_bindgen]
pub fn mercator_to_wgs84(coords: &[f64]) -> Vec<f64> {
    coords
        .chunks(2)
        .flat_map(|c| {
            let lon = c[0] / EARTH_RADIUS * 180.0 / PI;
            let lat = ((c[1] / EARTH_RADIUS).exp().atan() - PI / 4.0) * 360.0 / PI;
            [lon, lat]
        })
        .collect()
}

/// Reproject dispatcher
#[wasm_bindgen]
pub fn reproject_points(coords: &[f64], from_epsg: u32, to_epsg: u32) -> Result<Vec<f64>, JsValue> {
    match (from_epsg, to_epsg) {
        (4326, 3857) | (4326, 900913) => Ok(wgs84_to_mercator(coords)),
        (3857, 4326) | (900913, 4326) => Ok(mercator_to_wgs84(coords)),
        (a, b) if a == b => Ok(coords.to_vec()),
        _ => Err(JsValue::from_str(&format!(
            "Unsupported CRS pair: EPSG:{} → EPSG:{}",
            from_epsg, to_epsg
        ))),
    }
}

// ─── LOS ───

/// Generate evenly spaced sample segments between observer and target
/// observer: [x, y, z], target: [x, y, z]
/// Returns: [x0,y0,z0, x1,y1,z1, ...] (n sample points)
#[wasm_bindgen]
pub fn generate_los_segments(
    observer: &[f64],
    target: &[f64],
    sample_count: u32,
) -> Vec<f64> {
    let n = sample_count as usize;
    let mut result = Vec::with_capacity(n * 3);
    for i in 0..n {
        let t = i as f64 / (n - 1).max(1) as f64;
        result.push(observer[0] + t * (target[0] - observer[0]));
        result.push(observer[1] + t * (target[1] - observer[1]));
        result.push(observer[2] + t * (target[2] - observer[2]));
    }
    result
}

// ─── Tests ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wgs84_to_mercator_istanbul() {
        let coords = vec![28.9784, 41.0082];
        let result = wgs84_to_mercator(&coords);
        assert!((result[0] - 3_225_861.0).abs() < 100.0);
        assert!((result[1] - 5_013_551.0).abs() < 100.0);
    }

    #[test]
    fn test_roundtrip_4326_3857() {
        let original = vec![28.9784, 41.0082, -73.9857, 40.7484];
        let mercator = wgs84_to_mercator(&original);
        let back = mercator_to_wgs84(&mercator);
        for i in 0..original.len() {
            assert!(
                (original[i] - back[i]).abs() < 0.000001,
                "Mismatch at index {}: {} vs {}",
                i,
                original[i],
                back[i]
            );
        }
    }

    #[test]
    fn test_reproject_same_crs() {
        let coords = vec![1.0, 2.0, 3.0, 4.0];
        let result = reproject_points(&coords, 4326, 4326).unwrap();
        assert_eq!(result, coords);
    }

    // Note: reproject_points error case returns JsValue which panics on non-wasm targets.
    // This test runs only in wasm-bindgen-test (browser/node wasm context).
    // See wasm-core/tests/ for the wasm-specific error test.

    #[test]
    fn test_los_segments() {
        let observer = vec![0.0, 0.0, 100.0];
        let target = vec![1000.0, 0.0, 50.0];
        let segments = generate_los_segments(&observer, &target, 5);
        assert_eq!(segments.len(), 15); // 5 points × 3 coords
        // First point = observer
        assert_eq!(segments[0], 0.0);
        assert_eq!(segments[2], 100.0);
        // Last point = target
        assert_eq!(segments[12], 1000.0);
        assert_eq!(segments[14], 50.0);
    }

    #[test]
    fn test_empty_input() {
        assert!(wgs84_to_mercator(&[]).is_empty());
        assert!(mercator_to_wgs84(&[]).is_empty());
    }
}
