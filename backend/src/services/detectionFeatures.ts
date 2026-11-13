/**
 * Fixed-band + trend feature extraction for the two real sensors the hardware
 * ships with: temperature (°C) and vibration (0-20 scale) on the HICON HZB-160F
 * ice maker. There is no discharge pressure, suction temperature, or
 * frequency-domain vibration analysis — this module must never assume features
 * the ESP32 does not collect.
 *
 * Vibration bands (fixed, 0-20 scale):
 *   0-4   -> idle / off-range  (treated as normal, no alert)
 *   5-10  -> normal
 *   11-15 -> moderate
 *   16-20 -> critical
 *
 * These bands run ALONGSIDE the rolling z-score detector. The z-score decides
 * whether a reading is anomalous relative to recent history; the band acts as a
 * SEVERITY FLOOR so a critical-band reading (16-20) can never be downgraded to
 * "warning" even if the z-score alone looks mild.
 */

export type VibrationBand = 'idle' | 'normal' | 'moderate' | 'critical';
export type TemperatureTrend =
  | 'rising'
  | 'rising-rapid'
  | 'dropping'
  | 'stable'
  | 'slightly-elevated';

export function classifyVibrationBand(vibration: number): VibrationBand {
  if (!Number.isFinite(vibration)) return 'idle';
  if (vibration >= 16) return 'critical';
  if (vibration >= 11) return 'moderate';
  if (vibration >= 5) return 'normal';
  return 'idle';
}

/**
 * Severity implied by the fixed vibration band alone. `idle` (0-4) and `normal`
 * (5-10) both resolve to 'normal' — i.e. no alert from the band itself.
 * `moderate` resolves to 'warning' and `critical` to 'critical'.
 */
export function vibrationBandSeverity(
  band: VibrationBand
): 'normal' | 'warning' | 'critical' {
  if (band === 'critical') return 'critical';
  if (band === 'moderate') return 'warning';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Temperature trend features (used by the recommendation mapping, step 2).
// ---------------------------------------------------------------------------

/** A temperature rise of this many °C inside the short window counts as "rapid". */
export const RAPID_RISE_DEGREES = 5;
/** Short window (ms) over which a rapid rise must occur to be "rapid". */
export const RAPID_RISE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
/** °C above the recent baseline at which a stable temperature reads as "elevated". */
export const ELEVATED_OFFSET_DEGREES = 2.5;

export interface ReadingLike {
  temperature: number;
  date: number; // epoch ms
}

/**
 * Compute the temperature trend + rapid-rise flag for the current reading from
 * the recent history.
 *
 * @param current  the reading being evaluated (not present in `history`)
 * @param history  recent readings, chronological (oldest -> newest), excluding current
 */
export function computeTrendFeatures(
  current: ReadingLike,
  history: ReadingLike[]
): { temperatureTrend: TemperatureTrend; rapidRise: boolean } {
  const usable = history.filter(
    (r) => Number.isFinite(r.temperature) && Number.isFinite(r.date)
  );

  // Rapid rise: temperature climbed >= RAPID_RISE_DEGREES within the short window
  // (reads within RAPID_RISE_WINDOW_MS of the current timestamp only).
  const windowReadings = usable.filter(
    (r) => current.date - r.date <= RAPID_RISE_WINDOW_MS && current.date >= r.date
  );
  if (windowReadings.length >= 2) {
    const minTemp = Math.min(...windowReadings.map((r) => r.temperature));
    if (current.temperature - minTemp >= RAPID_RISE_DEGREES) {
      return { temperatureTrend: 'rising-rapid', rapidRise: true };
    }
  }

  // Otherwise fit a line over the last up to 10 readings using time as x.
  const recent = usable.slice(-10);
  const baselineMean =
    recent.length > 0
      ? recent.reduce((a, b) => a + b.temperature, 0) / recent.length
      : current.temperature;

  let slope: number | null = null;
  if (recent.length >= 3) {
    // Linear regression over epoch-ms. Work in minutes to keep numbers small.
    let sx = 0,
      sy = 0,
      sxy = 0,
      sxx = 0;
    const t0 = recent[0].date;
    let n = 0;
    for (const r of recent) {
      const x = (r.date - t0) / 60000; // minutes since first reading
      const y = r.temperature;
      sx += x;
      sy += y;
      sxy += x * y;
      sxx += x * x;
      n += 1;
    }
    const denom = n * sxx - sx * sx;
    slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom; // °C per minute
  }

  const slopePerHour = slope === null ? 0 : slope * 60;

  if (slopePerHour >= 15) return { temperatureTrend: 'rising', rapidRise: false };
  if (slopePerHour <= -15) return { temperatureTrend: 'dropping', rapidRise: false };

  // Stable direction, but running noticeably above the recent baseline.
  if (current.temperature - baselineMean >= ELEVATED_OFFSET_DEGREES) {
    return { temperatureTrend: 'slightly-elevated', rapidRise: false };
  }

  return { temperatureTrend: 'stable', rapidRise: false };
}