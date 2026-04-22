use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mapgpu_wasm_core::mvt_parse::parse_mvt;
use prost::Message;

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
    #[prost(int32, optional, tag = "3")]
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

fn build_sample_tile() -> Vec<u8> {
    let mut features = Vec::new();

    for i in 0..400u64 {
        features.push(Feature {
            id: Some(i),
            tags: vec![0, 0, 1, 1],
            r#type: Some(3),
            geometry: vec![9, 0, 0, 26, 16, 0, 0, 16, 31],
        });
    }

    let layer = Layer {
        name: "buildings".to_string(),
        features,
        keys: vec!["class".to_string(), "height".to_string()],
        values: vec![
            TileValue {
                string_value: Some("building".to_string()),
                float_value: None,
                double_value: None,
                int_value: None,
                uint_value: None,
                sint_value: None,
                bool_value: None,
            },
            TileValue {
                string_value: None,
                float_value: None,
                double_value: None,
                int_value: Some(24),
                uint_value: None,
                sint_value: None,
                bool_value: None,
            },
        ],
        extent: Some(4096),
        version: Some(2),
    };

    let tile = Tile { layers: vec![layer] };
    let mut out = Vec::new();
    tile.encode(&mut out).expect("tile encode");
    out
}

fn bench_parse_mvt(c: &mut Criterion) {
    let data = build_sample_tile();

    c.bench_function("parse_mvt_source_layer_whitelist", |b| {
        b.iter(|| {
            let json = parse_mvt(
                black_box(&data),
                Some("buildings".to_string()),
                Some("height".to_string()),
            )
            .expect("parse_mvt");
            black_box(json);
        })
    });
}

criterion_group!(benches, bench_parse_mvt);
criterion_main!(benches);
