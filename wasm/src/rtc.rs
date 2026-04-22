use wasm_bindgen::prelude::*;

// ─── RTC (Relative-to-Center) Encoding ───

/// Result of RTC encoding: positions relative to a center point,
/// stored as Float32 for GPU consumption.
#[wasm_bindgen]
pub struct RtcResult {
    /// Positions relative to center: [x0-cx, y0-cy, x1-cx, y1-cy, ...]
    positions: Vec<f32>,
    /// Center point that was used: [cx, cy]
    center: Vec<f64>,
}

#[wasm_bindgen]
impl RtcResult {
    #[wasm_bindgen(getter)]
    pub fn positions(&self) -> Vec<f32> {
        self.positions.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn center(&self) -> Vec<f64> {
        self.center.clone()
    }
}

/// Internal implementation returning a native Result (testable on all targets).
///
/// `positions`: interleaved f64 coordinates [x0, y0, x1, y1, ...]
/// `center`: [cx, cy] - the reference center point
///
/// Returns (f32 positions relative to center, center copy)
pub(crate) fn rtc_encode_impl(
    positions: &[f64],
    center: &[f64],
) -> Result<(Vec<f32>, Vec<f64>), String> {
    if positions.len() % 2 != 0 {
        return Err("rtc_encode: positions length must be even (2D coordinates)".into());
    }
    if center.len() != 2 {
        return Err("rtc_encode: center must have exactly 2 values [cx, cy]".into());
    }

    let cx = center[0];
    let cy = center[1];

    let result: Vec<f32> = positions
        .chunks(2)
        .flat_map(|c| {
            let rx = (c[0] - cx) as f32;
            let ry = (c[1] - cy) as f32;
            [rx, ry]
        })
        .collect();

    Ok((result, vec![cx, cy]))
}

/// Internal decode: reconstruct f64 positions from RTC f32 offsets + center.
pub(crate) fn rtc_decode_impl(
    rtc_positions: &[f32],
    center: &[f64],
) -> Result<Vec<f64>, String> {
    if rtc_positions.len() % 2 != 0 {
        return Err("rtc_decode: positions length must be even (2D coordinates)".into());
    }
    if center.len() != 2 {
        return Err("rtc_decode: center must have exactly 2 values [cx, cy]".into());
    }

    let cx = center[0];
    let cy = center[1];

    let result: Vec<f64> = rtc_positions
        .chunks(2)
        .flat_map(|c| {
            let x = cx + c[0] as f64;
            let y = cy + c[1] as f64;
            [x, y]
        })
        .collect();

    Ok(result)
}

/// Encode positions as Relative-to-Center offsets in Float32.
///
/// Subtracts the center from each coordinate and stores the result as f32.
/// This preserves precision for GPU rendering by keeping values small.
///
/// `positions`: flat f64 coordinate array [x0, y0, x1, y1, ...]
/// `center`: reference center [cx, cy]
///
/// Returns RtcResult with f32 offsets and the center used.
#[wasm_bindgen]
pub fn rtc_encode(positions: &[f64], center: &[f64]) -> Result<RtcResult, JsValue> {
    let (pos, ctr) = rtc_encode_impl(positions, center).map_err(|e| JsValue::from_str(&e))?;
    Ok(RtcResult {
        positions: pos,
        center: ctr,
    })
}

/// Decode RTC positions back to absolute f64 coordinates.
///
/// `rtc_positions`: Float32Array of relative offsets [dx0, dy0, ...]
/// `center`: the center used during encoding [cx, cy]
///
/// Returns the reconstructed f64 coordinates.
#[wasm_bindgen]
pub fn rtc_decode(rtc_positions: &[f32], center: &[f64]) -> Result<Vec<f64>, JsValue> {
    rtc_decode_impl(rtc_positions, center).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_encode() {
        let positions = vec![100.0, 200.0, 110.0, 210.0];
        let center = vec![105.0, 205.0];

        let (rtc, ctr) = rtc_encode_impl(&positions, &center).unwrap();

        assert_eq!(rtc.len(), 4);
        assert_eq!(ctr, center);

        // First point: (100 - 105, 200 - 205) = (-5, -5)
        assert!((rtc[0] - (-5.0_f32)).abs() < 1e-6);
        assert!((rtc[1] - (-5.0_f32)).abs() < 1e-6);

        // Second point: (110 - 105, 210 - 205) = (5, 5)
        assert!((rtc[2] - 5.0_f32).abs() < 1e-6);
        assert!((rtc[3] - 5.0_f32).abs() < 1e-6);
    }

    #[test]
    fn test_roundtrip_precision() {
        // Web Mercator coordinates (large values)
        let cx = 3_225_861.0_f64;
        let cy = 5_013_551.0_f64;

        // Points near the center (within a few hundred meters)
        let positions = vec![
            cx + 50.123, cy + 75.456,
            cx - 30.789, cy + 10.012,
            cx + 100.0, cy - 200.0,
        ];
        let center = vec![cx, cy];

        let (rtc, _) = rtc_encode_impl(&positions, &center).unwrap();
        let decoded = rtc_decode_impl(&rtc, &center).unwrap();

        // For small offsets (within a few hundred meters), float32 precision
        // should give us sub-meter accuracy
        for i in 0..positions.len() {
            let error = (positions[i] - decoded[i]).abs();
            assert!(
                error < 0.01, // Less than 1cm error for nearby coordinates
                "Position {} error too large: {} vs {}, error = {}",
                i, positions[i], decoded[i], error
            );
        }
    }

    #[test]
    fn test_large_mercator_coordinates() {
        // Maximum Web Mercator extent
        let positions = vec![
            20037508.342789244, 20037508.342789244,
            -20037508.342789244, -20037508.342789244,
        ];
        let center = vec![0.0, 0.0];

        let (rtc, _) = rtc_encode_impl(&positions, &center).unwrap();

        // Without RTC, these values as f32 would have ~2m error
        // With RTC centered at (0,0), the offsets are still large (worst case)
        assert_eq!(rtc.len(), 4);
        // The values exist even if precision is limited at this range
        assert!(rtc[0] > 0.0);
        assert!(rtc[2] < 0.0);
    }

    #[test]
    fn test_rtc_precision_improvement() {
        // Demonstrate that RTC improves precision compared to direct f32 cast
        let cx = 15_000_000.0_f64;
        let cy = 8_000_000.0_f64;
        let offset = 0.5_f64; // Half meter offset

        let positions = vec![cx + offset, cy + offset];
        let center = vec![cx, cy];

        // Direct f32 cast loses the 0.5m detail
        let direct_x = positions[0] as f32;
        let direct_error = (positions[0] - direct_x as f64).abs();

        // RTC: first subtract center, then cast to f32
        let (rtc, _) = rtc_encode_impl(&positions, &center).unwrap();
        let rtc_error = (offset - rtc[0] as f64).abs();

        // RTC error should be much smaller than direct cast error
        assert!(
            rtc_error < direct_error,
            "RTC error ({}) should be less than direct cast error ({})",
            rtc_error, direct_error
        );
        // RTC error should be very small for nearby offsets
        assert!(rtc_error < 0.001, "RTC error should be < 1mm, got {}", rtc_error);
    }

    #[test]
    fn test_empty_input() {
        let (rtc, ctr) = rtc_encode_impl(&[], &[0.0, 0.0]).unwrap();
        assert!(rtc.is_empty());
        assert_eq!(ctr, vec![0.0, 0.0]);
    }

    #[test]
    fn test_invalid_positions() {
        let result = rtc_encode_impl(&[1.0, 2.0, 3.0], &[0.0, 0.0]);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_center() {
        let result = rtc_encode_impl(&[1.0, 2.0], &[0.0]);
        assert!(result.is_err());

        let result = rtc_encode_impl(&[1.0, 2.0], &[0.0, 0.0, 0.0]);
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_basic() {
        let rtc_positions = vec![5.0_f32, -3.0_f32];
        let center = vec![100.0, 200.0];

        let decoded = rtc_decode_impl(&rtc_positions, &center).unwrap();
        assert!((decoded[0] - 105.0).abs() < 1e-6);
        assert!((decoded[1] - 197.0).abs() < 1e-6);
    }
}
