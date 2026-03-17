use wasm_bindgen::prelude::*;
use serde::Deserialize;

// ─── GeoJSON Parse → Binary Point Buffer ───

/// Binary representation of parsed GeoJSON Point features.
#[wasm_bindgen]
pub struct BinaryPointBuffer {
    positions: Vec<f64>,
    feature_ids: Vec<u32>,
}

#[wasm_bindgen]
impl BinaryPointBuffer {
    /// Point positions: [x0, y0, x1, y1, ...]
    #[wasm_bindgen(getter)]
    pub fn positions(&self) -> Vec<f64> {
        self.positions.clone()
    }

    /// Feature IDs (sequential, 0-based)
    #[wasm_bindgen(getter)]
    pub fn feature_ids(&self) -> Vec<u32> {
        self.feature_ids.clone()
    }

    /// Number of parsed features
    #[wasm_bindgen(getter)]
    pub fn feature_count(&self) -> u32 {
        self.feature_ids.len() as u32
    }
}

// Minimal GeoJSON deserialization structures (Point only, Phase 0)

#[derive(Deserialize)]
struct GeoJsonRoot {
    #[serde(rename = "type")]
    geojson_type: String,
    #[serde(default)]
    features: Vec<GeoJsonFeature>,
    // Also support a single geometry at root level
    #[serde(default)]
    geometry: Option<GeoJsonGeometry>,
    #[serde(default)]
    coordinates: Option<Vec<f64>>,
}

#[derive(Deserialize)]
struct GeoJsonFeature {
    #[serde(rename = "type")]
    _feature_type: Option<String>,
    geometry: Option<GeoJsonGeometry>,
}

#[derive(Deserialize)]
struct GeoJsonGeometry {
    #[serde(rename = "type")]
    geometry_type: String,
    coordinates: Option<serde_json::Value>,
}

/// Internal parse implementation that returns a native Result (testable on all targets).
pub(crate) fn parse_geojson_points_impl(json: &str) -> Result<BinaryPointBuffer, String> {
    let root: GeoJsonRoot =
        serde_json::from_str(json).map_err(|e| format!("JSON parse error: {}", e))?;

    let mut positions: Vec<f64> = Vec::new();
    let mut feature_ids: Vec<u32> = Vec::new();
    let mut next_id: u32 = 0;

    match root.geojson_type.as_str() {
        "FeatureCollection" => {
            for feature in &root.features {
                if let Some(geom) = &feature.geometry {
                    if extract_point(geom, &mut positions) {
                        feature_ids.push(next_id);
                    }
                }
                next_id += 1;
            }
        }
        "Feature" => {
            if let Some(geom) = &root.geometry {
                if extract_point(geom, &mut positions) {
                    feature_ids.push(0);
                }
            }
        }
        "Point" => {
            // Bare geometry at root
            if let Some(coords) = &root.coordinates {
                if coords.len() >= 2 {
                    positions.push(coords[0]);
                    positions.push(coords[1]);
                    feature_ids.push(0);
                }
            }
        }
        _ => {
            // Unsupported type, return empty
        }
    }

    Ok(BinaryPointBuffer {
        positions,
        feature_ids,
    })
}

/// Parse a GeoJSON string and extract Point geometries into a binary buffer.
///
/// Supports:
/// - FeatureCollection with Point features
/// - Single Feature with Point geometry
/// - Bare Point geometry
///
/// Non-Point geometries are silently skipped.
///
/// Returns BinaryPointBuffer with positions and feature_ids.
#[wasm_bindgen]
pub fn parse_geojson_points(json: &str) -> Result<BinaryPointBuffer, JsValue> {
    parse_geojson_points_impl(json).map_err(|e| JsValue::from_str(&e))
}

/// Try to extract a Point coordinate from a geometry. Returns true if successful.
fn extract_point(geom: &GeoJsonGeometry, positions: &mut Vec<f64>) -> bool {
    if geom.geometry_type != "Point" {
        return false;
    }
    if let Some(coords) = &geom.coordinates {
        if let Some(arr) = coords.as_array() {
            if arr.len() >= 2 {
                if let (Some(x), Some(y)) = (arr[0].as_f64(), arr[1].as_f64()) {
                    positions.push(x);
                    positions.push(y);
                    return true;
                }
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_feature_collection() {
        let json = r#"{
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [28.9784, 41.0082] },
                    "properties": { "name": "Istanbul" }
                },
                {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [32.8597, 39.9334] },
                    "properties": { "name": "Ankara" }
                },
                {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [27.1428, 38.4237] },
                    "properties": { "name": "Izmir" }
                }
            ]
        }"#;

        let result = parse_geojson_points_impl(json).unwrap();
        assert_eq!(result.feature_count(), 3);
        assert_eq!(result.positions.len(), 6); // 3 points * 2 coords
        assert_eq!(result.feature_ids, vec![0, 1, 2]);
        // Check first point
        assert!((result.positions[0] - 28.9784).abs() < 1e-10);
        assert!((result.positions[1] - 41.0082).abs() < 1e-10);
    }

    #[test]
    fn test_parse_mixed_geometries() {
        // Only Point geometries should be extracted; LineString should be skipped
        let json = r#"{
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [1.0, 2.0] },
                    "properties": {}
                },
                {
                    "type": "Feature",
                    "geometry": { "type": "LineString", "coordinates": [[0,0],[1,1]] },
                    "properties": {}
                },
                {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [3.0, 4.0] },
                    "properties": {}
                }
            ]
        }"#;

        let result = parse_geojson_points_impl(json).unwrap();
        assert_eq!(result.feature_count(), 2);
        assert_eq!(result.positions.len(), 4);
        // Feature IDs correspond to original feature indices (0 and 2)
        assert_eq!(result.feature_ids, vec![0, 2]);
    }

    #[test]
    fn test_parse_single_point_geometry() {
        let json = r#"{ "type": "Point", "coordinates": [10.5, 20.3] }"#;
        let result = parse_geojson_points_impl(json).unwrap();
        assert_eq!(result.feature_count(), 1);
        assert!((result.positions[0] - 10.5).abs() < 1e-10);
        assert!((result.positions[1] - 20.3).abs() < 1e-10);
    }

    #[test]
    fn test_parse_invalid_json() {
        let json = "this is not json";
        let result = parse_geojson_points_impl(json);
        assert!(result.is_err());
    }
}
