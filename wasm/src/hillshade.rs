use wasm_bindgen::prelude::*;

/// Compute hillshade from an elevation grid using Horn's method.
///
/// # Arguments
/// * `elevations` - Row-major elevation grid (Int16 values)
/// * `width` - Grid width (columns)
/// * `height` - Grid height (rows)
/// * `cell_size_x` - Horizontal cell size in meters
/// * `cell_size_y` - Vertical cell size in meters
/// * `azimuth` - Sun azimuth in degrees (clockwise from north)
/// * `altitude` - Sun altitude in degrees above horizon
///
/// # Returns
/// Luminance array (0-255), same dimensions as input
#[wasm_bindgen]
pub fn compute_hillshade(
    elevations: &[i16],
    width: u32,
    height: u32,
    cell_size_x: f64,
    cell_size_y: f64,
    azimuth: f64,
    altitude: f64,
) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let mut result = vec![0u8; w * h];

    // Convert angles
    let azimuth_rad = (360.0 - azimuth + 90.0).to_radians();
    let altitude_rad = altitude.to_radians();
    let sin_alt = altitude_rad.sin();
    let cos_alt = altitude_rad.cos();

    // NODATA sentinel
    const NODATA: i16 = -32767;

    for y in 0..h {
        for x in 0..w {
            let idx = y * w + x;

            // Edge pixels: constant shade
            if x == 0 || x == w - 1 || y == 0 || y == h - 1 {
                result[idx] = 180;
                continue;
            }

            let e = elevations[idx];
            if e == NODATA {
                result[idx] = 0;
                continue;
            }

            // 3×3 neighborhood (Horn's numbering)
            //  a  b  c
            //  d  e  f
            //  g  h  i
            let a = get_elev(elevations, w, x - 1, y - 1);
            let b = get_elev(elevations, w, x, y - 1);
            let c = get_elev(elevations, w, x + 1, y - 1);
            let d = get_elev(elevations, w, x - 1, y);
            let f = get_elev(elevations, w, x + 1, y);
            let g = get_elev(elevations, w, x - 1, y + 1);
            let h_val = get_elev(elevations, w, x, y + 1);
            let i = get_elev(elevations, w, x + 1, y + 1);

            // Horn's partial derivatives
            let dzdx = ((c + 2.0 * f + i) - (a + 2.0 * d + g)) / (8.0 * cell_size_x);
            let dzdy = ((g + 2.0 * h_val + i) - (a + 2.0 * b + c)) / (8.0 * cell_size_y);

            // Slope and aspect
            let slope = (dzdx * dzdx + dzdy * dzdy).sqrt().atan();
            let aspect = dzdy.atan2(-dzdx);

            // Hillshade (Lambertian)
            let shade = sin_alt * slope.cos()
                + cos_alt * slope.sin() * (azimuth_rad - aspect).cos();

            let shade_clamped = shade.clamp(0.0, 1.0);
            result[idx] = (shade_clamped * 255.0).round() as u8;
        }
    }

    result
}

#[inline]
fn get_elev(data: &[i16], width: usize, x: usize, y: usize) -> f64 {
    let val = data[y * width + x];
    if val == -32767 { 0.0 } else { val as f64 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flat_terrain_produces_uniform_shade() {
        // Flat terrain at elevation 100m → uniform hillshade
        let w = 10u32;
        let h = 10u32;
        let elevations = vec![100i16; (w * h) as usize];

        let result = compute_hillshade(&elevations, w, h, 30.0, 30.0, 315.0, 45.0);

        assert_eq!(result.len(), (w * h) as usize);

        // Interior pixels should be ~180 (flat terrain, angle between sun and surface normal)
        // cos(45°) ≈ 0.707 → ~180 on 0-255 scale
        for y in 1..(h - 1) as usize {
            for x in 1..(w - 1) as usize {
                let val = result[y * w as usize + x];
                assert!(val > 150, "Expected >150, got {} at ({},{})", val, x, y);
            }
        }
    }

    #[test]
    fn test_nodata_produces_zero() {
        let w = 5u32;
        let h = 5u32;
        let mut elevations = vec![100i16; (w * h) as usize];
        elevations[12] = -32767; // Center pixel NODATA

        let result = compute_hillshade(&elevations, w, h, 30.0, 30.0, 315.0, 45.0);
        assert_eq!(result[12], 0); // NODATA → 0
    }

    #[test]
    fn test_edge_pixels_constant() {
        let w = 5u32;
        let h = 5u32;
        let elevations = vec![100i16; (w * h) as usize];

        let result = compute_hillshade(&elevations, w, h, 30.0, 30.0, 315.0, 45.0);

        // All edge pixels should be 180
        assert_eq!(result[0], 180);
        assert_eq!(result[4], 180);
        assert_eq!(result[20], 180);
        assert_eq!(result[24], 180);
    }

    #[test]
    fn test_sloped_terrain() {
        // Create a west-to-east slope: elevation increases with x
        let w = 10u32;
        let h = 10u32;
        let mut elevations = vec![0i16; (w * h) as usize];
        for y in 0..h as usize {
            for x in 0..w as usize {
                elevations[y * w as usize + x] = (x * 100) as i16;
            }
        }

        let result = compute_hillshade(&elevations, w, h, 30.0, 30.0, 315.0, 45.0);

        // Interior pixels should have reasonable values
        for y in 1..(h - 1) as usize {
            for x in 1..(w - 1) as usize {
                let val = result[y * w as usize + x];
                assert!(val > 0, "Expected >0 shade on slope at ({},{})", x, y);
            }
        }
    }
}
