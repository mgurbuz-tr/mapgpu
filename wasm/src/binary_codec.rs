use wasm_bindgen::prelude::*;

// ─── Binary Codec (SoA pack/unpack) ───

// Binary format layout:
//
// Header (16 bytes):
//   [0..4]   u32  magic (0x4D475055 = "MGPU")
//   [4..8]   u32  version (1)
//   [8..12]  u32  feature_count
//   [12..16] u32  geometry_type (1=Point, 2=LineString, 3=Polygon)
//
// Positions section:
//   [16..20]      u32  coord_count (number of xy pairs)
//   [20..20+N*16] f64  positions [x0, y0, x1, y1, ...] (N = coord_count)
//
// Offsets section (for multi-part geometries):
//   [..]  u32  offset_count
//   [..]  u32  offsets [o0, o1, ...]
//
// Attributes section:
//   [..]  u32  attr_count (number of attribute columns)
//   For each attribute column:
//     [..]  u8   attr_type (0=f64, 1=i32, 2=string)
//     [..]  u32  name_len
//     [..]  u8   name_bytes[name_len] (UTF-8 encoded name)
//     [..]  data  (type-dependent, feature_count values)
//       f64: feature_count * 8 bytes
//       i32: feature_count * 4 bytes
//       string: for each feature: u32 len + bytes[len]

const MAGIC: u32 = 0x4D475055; // "MGPU"
const VERSION: u32 = 1;

/// Packed binary feature buffer handle.
#[wasm_bindgen]
pub struct PackedFeatures {
    data: Vec<u8>,
}

#[wasm_bindgen]
impl PackedFeatures {
    /// Get the packed binary data
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }

    /// Get the byte length of the packed data
    #[wasm_bindgen(getter)]
    pub fn byte_length(&self) -> u32 {
        self.data.len() as u32
    }
}

/// Unpacked feature data.
#[wasm_bindgen]
pub struct UnpackedFeatures {
    geometry_type: u32,
    positions: Vec<f64>,
    offsets: Vec<u32>,
    feature_count: u32,
    // Attributes stored as serialized JSON string for wasm-bindgen compatibility
    attributes_json: String,
}

#[wasm_bindgen]
impl UnpackedFeatures {
    #[wasm_bindgen(getter)]
    pub fn geometry_type(&self) -> u32 {
        self.geometry_type
    }

    #[wasm_bindgen(getter)]
    pub fn positions(&self) -> Vec<f64> {
        self.positions.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn offsets(&self) -> Vec<u32> {
        self.offsets.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn feature_count(&self) -> u32 {
        self.feature_count
    }

    #[wasm_bindgen(getter)]
    pub fn attributes_json(&self) -> String {
        self.attributes_json.clone()
    }
}

// ─── Internal attribute representation ───

#[derive(Clone, Debug)]
pub(crate) enum AttrValue {
    Float(f64),
    Int(i32),
    Str(String),
}

#[derive(Clone, Debug)]
pub(crate) struct AttrColumn {
    name: String,
    values: Vec<AttrValue>,
}

// ─── Helper: byte reading/writing ───

struct ByteWriter {
    buf: Vec<u8>,
}

impl ByteWriter {
    fn new() -> Self {
        ByteWriter { buf: Vec::new() }
    }

    fn write_u8(&mut self, v: u8) {
        self.buf.push(v);
    }

    fn write_u32(&mut self, v: u32) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    fn write_f64(&mut self, v: f64) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    fn write_i32(&mut self, v: i32) {
        self.buf.extend_from_slice(&v.to_le_bytes());
    }

    fn write_bytes(&mut self, bytes: &[u8]) {
        self.buf.extend_from_slice(bytes);
    }
}

struct ByteReader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> ByteReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        ByteReader { data, pos: 0 }
    }

    fn remaining(&self) -> usize {
        self.data.len().saturating_sub(self.pos)
    }

    fn read_u8(&mut self) -> Result<u8, String> {
        if self.remaining() < 1 {
            return Err("Unexpected end of buffer reading u8".into());
        }
        let v = self.data[self.pos];
        self.pos += 1;
        Ok(v)
    }

    fn read_u32(&mut self) -> Result<u32, String> {
        if self.remaining() < 4 {
            return Err("Unexpected end of buffer reading u32".into());
        }
        let bytes: [u8; 4] = self.data[self.pos..self.pos + 4].try_into().unwrap();
        self.pos += 4;
        Ok(u32::from_le_bytes(bytes))
    }

    fn read_f64(&mut self) -> Result<f64, String> {
        if self.remaining() < 8 {
            return Err("Unexpected end of buffer reading f64".into());
        }
        let bytes: [u8; 8] = self.data[self.pos..self.pos + 8].try_into().unwrap();
        self.pos += 8;
        Ok(f64::from_le_bytes(bytes))
    }

    fn read_i32(&mut self) -> Result<i32, String> {
        if self.remaining() < 4 {
            return Err("Unexpected end of buffer reading i32".into());
        }
        let bytes: [u8; 4] = self.data[self.pos..self.pos + 4].try_into().unwrap();
        self.pos += 4;
        Ok(i32::from_le_bytes(bytes))
    }

    fn read_bytes(&mut self, len: usize) -> Result<&'a [u8], String> {
        if self.remaining() < len {
            return Err(format!("Unexpected end of buffer reading {} bytes", len));
        }
        let slice = &self.data[self.pos..self.pos + len];
        self.pos += len;
        Ok(slice)
    }
}

// ─── Pack implementation ───

pub(crate) fn pack_features_impl(
    geometry_type: u32,
    positions: &[f64],
    offsets: &[u32],
    feature_count: u32,
    attributes: &[AttrColumn],
) -> Result<Vec<u8>, String> {
    if positions.len() % 2 != 0 {
        return Err("pack_features: positions length must be even".into());
    }

    let mut w = ByteWriter::new();

    // Header
    w.write_u32(MAGIC);
    w.write_u32(VERSION);
    w.write_u32(feature_count);
    w.write_u32(geometry_type);

    // Positions section
    let coord_count = (positions.len() / 2) as u32;
    w.write_u32(coord_count);
    for &v in positions {
        w.write_f64(v);
    }

    // Offsets section
    w.write_u32(offsets.len() as u32);
    for &o in offsets {
        w.write_u32(o);
    }

    // Attributes section
    w.write_u32(attributes.len() as u32);
    for col in attributes {
        if col.values.len() != feature_count as usize {
            return Err(format!(
                "pack_features: attribute '{}' has {} values but feature_count is {}",
                col.name,
                col.values.len(),
                feature_count
            ));
        }

        // Determine attribute type from first value (or default to f64 if empty)
        let attr_type: u8 = if col.values.is_empty() {
            0
        } else {
            match &col.values[0] {
                AttrValue::Float(_) => 0,
                AttrValue::Int(_) => 1,
                AttrValue::Str(_) => 2,
            }
        };

        w.write_u8(attr_type);

        // Name
        let name_bytes = col.name.as_bytes();
        w.write_u32(name_bytes.len() as u32);
        w.write_bytes(name_bytes);

        // Values
        for val in &col.values {
            match val {
                AttrValue::Float(f) => w.write_f64(*f),
                AttrValue::Int(i) => w.write_i32(*i),
                AttrValue::Str(s) => {
                    let s_bytes = s.as_bytes();
                    w.write_u32(s_bytes.len() as u32);
                    w.write_bytes(s_bytes);
                }
            }
        }
    }

    Ok(w.buf)
}

// ─── Unpack implementation ───

pub(crate) fn unpack_features_impl(
    data: &[u8],
) -> Result<(u32, Vec<f64>, Vec<u32>, u32, Vec<AttrColumn>), String> {
    let mut r = ByteReader::new(data);

    // Header
    let magic = r.read_u32()?;
    if magic != MAGIC {
        return Err(format!("unpack_features: invalid magic 0x{:08X}, expected 0x{:08X}", magic, MAGIC));
    }

    let version = r.read_u32()?;
    if version != VERSION {
        return Err(format!("unpack_features: unsupported version {}, expected {}", version, VERSION));
    }

    let feature_count = r.read_u32()?;
    let geometry_type = r.read_u32()?;

    // Positions
    let coord_count = r.read_u32()? as usize;
    let mut positions = Vec::with_capacity(coord_count * 2);
    for _ in 0..coord_count * 2 {
        positions.push(r.read_f64()?);
    }

    // Offsets
    let offset_count = r.read_u32()? as usize;
    let mut offsets = Vec::with_capacity(offset_count);
    for _ in 0..offset_count {
        offsets.push(r.read_u32()?);
    }

    // Attributes
    let attr_count = r.read_u32()? as usize;
    let mut attributes = Vec::with_capacity(attr_count);

    for _ in 0..attr_count {
        let attr_type = r.read_u8()?;

        let name_len = r.read_u32()? as usize;
        let name_bytes = r.read_bytes(name_len)?;
        let name = String::from_utf8(name_bytes.to_vec())
            .map_err(|e| format!("unpack_features: invalid UTF-8 in attribute name: {}", e))?;

        let mut values = Vec::with_capacity(feature_count as usize);
        for _ in 0..feature_count {
            let val = match attr_type {
                0 => AttrValue::Float(r.read_f64()?),
                1 => AttrValue::Int(r.read_i32()?),
                2 => {
                    let slen = r.read_u32()? as usize;
                    let sbytes = r.read_bytes(slen)?;
                    let s = String::from_utf8(sbytes.to_vec())
                        .map_err(|e| format!("unpack_features: invalid UTF-8 in string attr: {}", e))?;
                    AttrValue::Str(s)
                }
                _ => return Err(format!("unpack_features: unknown attr_type {}", attr_type)),
            };
            values.push(val);
        }

        attributes.push(AttrColumn { name, values });
    }

    Ok((geometry_type, positions, offsets, feature_count, attributes))
}

fn attrs_to_json(attributes: &[AttrColumn]) -> String {
    // Simple JSON serialization without external dependency
    let mut parts = Vec::new();
    for col in attributes {
        let vals: Vec<String> = col.values.iter().map(|v| match v {
            AttrValue::Float(f) => format!("{}", f),
            AttrValue::Int(i) => format!("{}", i),
            AttrValue::Str(s) => format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"")),
        }).collect();
        let attr_type = if col.values.is_empty() {
            "float"
        } else {
            match &col.values[0] {
                AttrValue::Float(_) => "float",
                AttrValue::Int(_) => "int",
                AttrValue::Str(_) => "string",
            }
        };
        parts.push(format!(
            "{{\"name\":\"{}\",\"type\":\"{}\",\"values\":[{}]}}",
            col.name, attr_type, vals.join(",")
        ));
    }
    format!("[{}]", parts.join(","))
}

// ─── WASM exports ───

/// Pack features into a compact binary buffer (SoA format).
///
/// `geometry_type`: 1=Point, 2=LineString, 3=Polygon
/// `positions`: flat coordinate array [x0, y0, x1, y1, ...]
/// `offsets`: geometry part boundaries
/// `feature_count`: number of features
///
/// Returns PackedFeatures containing the binary buffer.
#[wasm_bindgen]
pub fn pack_features(
    geometry_type: u32,
    positions: &[f64],
    offsets: &[u32],
    feature_count: u32,
) -> Result<PackedFeatures, JsValue> {
    let data = pack_features_impl(geometry_type, positions, offsets, feature_count, &[])
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(PackedFeatures { data })
}

/// Unpack a binary feature buffer back into component arrays.
///
/// Returns UnpackedFeatures with geometry_type, positions, offsets, feature_count, and attributes.
#[wasm_bindgen]
pub fn unpack_features(data: &[u8]) -> Result<UnpackedFeatures, JsValue> {
    let (geometry_type, positions, offsets, feature_count, attributes) =
        unpack_features_impl(data).map_err(|e| JsValue::from_str(&e))?;

    let attributes_json = attrs_to_json(&attributes);

    Ok(UnpackedFeatures {
        geometry_type,
        positions,
        offsets,
        feature_count,
        attributes_json,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_roundtrip_points() {
        let positions = vec![28.9784, 41.0082, 32.8597, 39.9334];
        let offsets = vec![0u32, 1, 2];
        let feature_count = 2;
        let geometry_type = 1; // Point

        let packed = pack_features_impl(geometry_type, &positions, &offsets, feature_count, &[]).unwrap();
        let (gt, pos, off, fc, attrs) = unpack_features_impl(&packed).unwrap();

        assert_eq!(gt, geometry_type);
        assert_eq!(fc, feature_count);
        assert_eq!(pos, positions);
        assert_eq!(off, offsets);
        assert!(attrs.is_empty());
    }

    #[test]
    fn test_roundtrip_with_attributes() {
        let positions = vec![1.0, 2.0, 3.0, 4.0];
        let offsets = vec![0u32, 1, 2];
        let feature_count = 2;
        let geometry_type = 1;

        let attributes = vec![
            AttrColumn {
                name: "height".into(),
                values: vec![AttrValue::Float(100.5), AttrValue::Float(200.3)],
            },
            AttrColumn {
                name: "id".into(),
                values: vec![AttrValue::Int(42), AttrValue::Int(99)],
            },
            AttrColumn {
                name: "name".into(),
                values: vec![AttrValue::Str("Istanbul".into()), AttrValue::Str("Ankara".into())],
            },
        ];

        let packed = pack_features_impl(geometry_type, &positions, &offsets, feature_count, &attributes).unwrap();
        let (gt, pos, off, fc, attrs) = unpack_features_impl(&packed).unwrap();

        assert_eq!(gt, geometry_type);
        assert_eq!(fc, feature_count);
        assert_eq!(pos, positions);
        assert_eq!(off, offsets);
        assert_eq!(attrs.len(), 3);

        // Verify attribute values
        assert_eq!(attrs[0].name, "height");
        if let AttrValue::Float(v) = &attrs[0].values[0] {
            assert!((v - 100.5).abs() < 1e-10);
        } else {
            panic!("Expected Float attribute");
        }

        assert_eq!(attrs[1].name, "id");
        if let AttrValue::Int(v) = &attrs[1].values[0] {
            assert_eq!(*v, 42);
        } else {
            panic!("Expected Int attribute");
        }

        assert_eq!(attrs[2].name, "name");
        if let AttrValue::Str(v) = &attrs[2].values[0] {
            assert_eq!(v, "Istanbul");
        } else {
            panic!("Expected Str attribute");
        }
        if let AttrValue::Str(v) = &attrs[2].values[1] {
            assert_eq!(v, "Ankara");
        } else {
            panic!("Expected Str attribute");
        }
    }

    #[test]
    fn test_roundtrip_empty() {
        let packed = pack_features_impl(1, &[], &[], 0, &[]).unwrap();
        let (gt, pos, off, fc, attrs) = unpack_features_impl(&packed).unwrap();

        assert_eq!(gt, 1);
        assert_eq!(fc, 0);
        assert!(pos.is_empty());
        assert!(off.is_empty());
        assert!(attrs.is_empty());
    }

    #[test]
    fn test_roundtrip_single_feature() {
        let positions = vec![10.0, 20.0];
        let offsets = vec![0u32, 1];
        let attrs = vec![AttrColumn {
            name: "val".into(),
            values: vec![AttrValue::Float(3.14)],
        }];

        let packed = pack_features_impl(1, &positions, &offsets, 1, &attrs).unwrap();
        let (_, pos, off, fc, a) = unpack_features_impl(&packed).unwrap();

        assert_eq!(fc, 1);
        assert_eq!(pos, positions);
        assert_eq!(off, offsets);
        assert_eq!(a.len(), 1);
    }

    #[test]
    fn test_invalid_magic() {
        let bad_data = vec![0u8; 16]; // All zeros, magic won't match
        let result = unpack_features_impl(&bad_data);
        assert!(result.is_err());
    }

    #[test]
    fn test_truncated_data() {
        let result = unpack_features_impl(&[0x55, 0x50, 0x47, 0x4D]); // Only 4 bytes
        assert!(result.is_err());
    }

    #[test]
    fn test_attrs_to_json_output() {
        let attrs = vec![
            AttrColumn {
                name: "pop".into(),
                values: vec![AttrValue::Int(1000), AttrValue::Int(2000)],
            },
        ];
        let json = attrs_to_json(&attrs);
        assert!(json.contains("\"name\":\"pop\""));
        assert!(json.contains("1000"));
        assert!(json.contains("2000"));
    }

    #[test]
    fn test_odd_positions_error() {
        let result = pack_features_impl(1, &[1.0, 2.0, 3.0], &[], 1, &[]);
        assert!(result.is_err());
    }
}
