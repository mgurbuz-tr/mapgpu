use std::collections::HashSet;

use prost::Message;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
enum GeomType {
    Unknown = 0,
    Point = 1,
    Linestring = 2,
    Polygon = 3,
}

#[derive(Clone, PartialEq, Message)]
struct Tile {
    #[prost(message, repeated, tag = "3")]
    layers: Vec<Layer>,
}

#[derive(Clone, PartialEq, Message)]
struct Layer {
    #[prost(string, tag = "1")]
    name: String,
    #[prost(message, repeated, tag = "2")]
    features: Vec<Feature>,
    #[prost(string, repeated, tag = "3")]
    keys: Vec<String>,
    #[prost(message, repeated, tag = "4")]
    values: Vec<TileValue>,
    #[prost(uint32, optional, tag = "5")]
    extent: Option<u32>,
    #[prost(uint32, optional, tag = "15")]
    version: Option<u32>,
}

#[derive(Clone, PartialEq, Message)]
struct Feature {
    #[prost(uint64, optional, tag = "1")]
    id: Option<u64>,
    #[prost(uint32, repeated, packed = "true", tag = "2")]
    tags: Vec<u32>,
    #[prost(enumeration = "GeomType", optional, tag = "3")]
    r#type: Option<i32>,
    #[prost(uint32, repeated, packed = "true", tag = "4")]
    geometry: Vec<u32>,
}

#[derive(Clone, PartialEq, Message)]
struct TileValue {
    #[prost(string, optional, tag = "1")]
    string_value: Option<String>,
    #[prost(float, optional, tag = "2")]
    float_value: Option<f32>,
    #[prost(double, optional, tag = "3")]
    double_value: Option<f64>,
    #[prost(int64, optional, tag = "4")]
    int_value: Option<i64>,
    #[prost(uint64, optional, tag = "5")]
    uint_value: Option<u64>,
    #[prost(sint64, optional, tag = "6")]
    sint_value: Option<i64>,
    #[prost(bool, optional, tag = "7")]
    bool_value: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ParsedMvtFeature {
    pub id: u64,
    pub geom_type: u8,
    pub geometry: Vec<u32>,
    pub attributes: Map<String, Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ParsedMvtLayer {
    pub name: String,
    pub extent: u32,
    pub version: u32,
    pub feature_count: usize,
    pub features: Vec<ParsedMvtFeature>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ParsedMvtDocument {
    pub layer_count: usize,
    pub feature_count: usize,
    pub layers: Vec<ParsedMvtLayer>,
}

pub fn parse_mvt_impl(
    data: &[u8],
    source_layer: Option<&str>,
    attribute_whitelist: Option<&HashSet<String>>,
) -> Result<ParsedMvtDocument, String> {
    let tile = Tile::decode(data).map_err(|e| format!("mvt decode error: {}", e))?;

    let mut parsed_layers = Vec::new();
    let mut total_feature_count = 0usize;

    for layer in tile.layers {
        if let Some(filter_layer) = source_layer {
            if layer.name != filter_layer {
                continue;
            }
        }

        let mut parsed_features = Vec::with_capacity(layer.features.len());

        for feature in layer.features {
            let mut attributes = Map::<String, Value>::new();

            let mut i = 0usize;
            while i + 1 < feature.tags.len() {
                let key_idx = feature.tags[i] as usize;
                let value_idx = feature.tags[i + 1] as usize;
                i += 2;

                let Some(key) = layer.keys.get(key_idx) else {
                    continue;
                };

                if let Some(whitelist) = attribute_whitelist {
                    if !whitelist.contains(key) {
                        continue;
                    }
                }

                if let Some(value) = layer.values.get(value_idx) {
                    attributes.insert(key.clone(), tile_value_to_json(value));
                }
            }

            let geom_type = feature.r#type.unwrap_or(GeomType::Unknown as i32) as u8;
            parsed_features.push(ParsedMvtFeature {
                id: feature.id.unwrap_or(0),
                geom_type,
                geometry: feature.geometry,
                attributes,
            });
        }

        total_feature_count += parsed_features.len();

        parsed_layers.push(ParsedMvtLayer {
            name: layer.name,
            extent: layer.extent.unwrap_or(4096),
            version: layer.version.unwrap_or(1),
            feature_count: parsed_features.len(),
            features: parsed_features,
        });
    }

    Ok(ParsedMvtDocument {
        layer_count: parsed_layers.len(),
        feature_count: total_feature_count,
        layers: parsed_layers,
    })
}

/// Parse Mapbox Vector Tile data and return filtered feature payload as JSON.
///
/// - `source_layer`: optional layer-name filter
/// - `attribute_whitelist_csv`: optional comma-separated list of attribute names
#[wasm_bindgen]
pub fn parse_mvt(
    data: &[u8],
    source_layer: Option<String>,
    attribute_whitelist_csv: Option<String>,
) -> Result<String, JsValue> {
    let whitelist_set = attribute_whitelist_csv
        .as_deref()
        .map(parse_whitelist_csv)
        .filter(|set| !set.is_empty());

    let parsed = parse_mvt_impl(
        data,
        source_layer.as_deref(),
        whitelist_set.as_ref(),
    )
    .map_err(|e| JsValue::from_str(&e))?;

    serde_json::to_string(&parsed)
        .map_err(|e| JsValue::from_str(&format!("mvt serialize error: {}", e)))
}

fn parse_whitelist_csv(csv: &str) -> HashSet<String> {
    csv.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn tile_value_to_json(value: &TileValue) -> Value {
    if let Some(s) = &value.string_value {
        return Value::String(s.clone());
    }

    if let Some(f) = value.float_value {
        return number_or_null(f as f64);
    }

    if let Some(d) = value.double_value {
        return number_or_null(d);
    }

    if let Some(i) = value.int_value {
        return Value::from(i);
    }

    if let Some(u) = value.uint_value {
        return Value::from(u);
    }

    if let Some(si) = value.sint_value {
        return Value::from(si);
    }

    if let Some(b) = value.bool_value {
        return Value::Bool(b);
    }

    Value::Null
}

fn number_or_null(value: f64) -> Value {
    if let Some(number) = serde_json::Number::from_f64(value) {
        Value::Number(number)
    } else {
        Value::Null
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn value_string(v: &str) -> TileValue {
        TileValue {
            string_value: Some(v.to_string()),
            float_value: None,
            double_value: None,
            int_value: None,
            uint_value: None,
            sint_value: None,
            bool_value: None,
        }
    }

    fn value_int(v: i64) -> TileValue {
        TileValue {
            string_value: None,
            float_value: None,
            double_value: None,
            int_value: Some(v),
            uint_value: None,
            sint_value: None,
            bool_value: None,
        }
    }

    fn encode_test_tile() -> Vec<u8> {
        let roads = Layer {
            name: "roads".to_string(),
            features: vec![Feature {
                id: Some(1),
                tags: vec![0, 0, 1, 1],
                r#type: Some(GeomType::Linestring as i32),
                geometry: vec![9, 0, 0, 10, 2, 2],
            }],
            keys: vec!["class".to_string(), "name".to_string()],
            values: vec![value_string("primary"), value_string("Main St")],
            extent: Some(4096),
            version: Some(2),
        };

        let buildings = Layer {
            name: "buildings".to_string(),
            features: vec![Feature {
                id: Some(99),
                tags: vec![0, 0, 1, 1],
                r#type: Some(GeomType::Polygon as i32),
                geometry: vec![9, 0, 0, 26, 2, 0, 0, 2, 15],
            }],
            keys: vec!["height".to_string(), "name".to_string()],
            values: vec![value_int(24), value_string("Tower")],
            extent: Some(4096),
            version: Some(2),
        };

        let tile = Tile {
            layers: vec![roads, buildings],
        };

        let mut out = Vec::new();
        tile.encode(&mut out).unwrap();
        out
    }

    #[test]
    fn parse_mvt_impl_reads_all_layers() {
        let data = encode_test_tile();
        let parsed = parse_mvt_impl(&data, None, None).unwrap();

        assert_eq!(parsed.layer_count, 2);
        assert_eq!(parsed.feature_count, 2);

        let roads = parsed
            .layers
            .iter()
            .find(|layer| layer.name == "roads")
            .unwrap();
        assert_eq!(roads.feature_count, 1);
        assert_eq!(roads.features[0].attributes["class"], Value::String("primary".to_string()));
    }

    #[test]
    fn parse_mvt_impl_filters_source_layer_and_attributes() {
        let data = encode_test_tile();
        let whitelist = HashSet::from(["height".to_string()]);
        let parsed = parse_mvt_impl(&data, Some("buildings"), Some(&whitelist)).unwrap();

        assert_eq!(parsed.layer_count, 1);
        assert_eq!(parsed.feature_count, 1);
        assert_eq!(parsed.layers[0].name, "buildings");
        assert_eq!(parsed.layers[0].features[0].attributes.len(), 1);
        assert_eq!(parsed.layers[0].features[0].attributes["height"], Value::from(24));
    }

    #[test]
    fn parse_mvt_wasm_export_returns_json() {
        let data = encode_test_tile();
        let result = parse_mvt(&data, Some("roads".to_string()), Some("name".to_string())).unwrap();
        let json: ParsedMvtDocument = serde_json::from_str(&result).unwrap();

        assert_eq!(json.layer_count, 1);
        assert_eq!(json.feature_count, 1);
        assert_eq!(json.layers[0].features[0].attributes.len(), 1);
        assert_eq!(json.layers[0].features[0].attributes["name"], Value::String("Main St".to_string()));
    }

    #[test]
    fn parse_mvt_impl_rejects_invalid_payload() {
        let invalid = vec![1u8, 2, 3, 4];
        let result = parse_mvt_impl(&invalid, None, None);
        assert!(result.is_err());
    }
}
