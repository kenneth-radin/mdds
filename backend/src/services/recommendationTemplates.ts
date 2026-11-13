/**
 * Recommendation templates keyed to the two sensor signals the HICON HZB-160F
 * ice maker actually produces: temperature trend (°C) and vibration band
 * (0-20 scale). There is no discharge pressure, suction temperature, or
 * frequency-domain vibration data — so no template may reference them.
 *
 * Resolution is done by getRecommendationForDetection(), which returns the same
 * `{ message, recommendation }` shape as before.
 */

import { VibrationBand, TemperatureTrend } from './detectionFeatures';

export interface RecommendationTemplate {
  /** Stable key, e.g. "rising-critical". */
  condition: string;
  message: string;
  recommendation: string;
}

/** Vibration bands that can appear in a template condition key. */
export type TemplateVibrationBand =
  | 'critical'
  | 'moderate'
  | 'normal-moderate'
  | 'any'
  | 'n-a';

export const recommendationTemplates: RecommendationTemplate[] = [
  {
    condition: 'rising-critical',
    message: 'Temperature rising steadily with critical vibration.',
    recommendation:
      'Condenser scaling, restricted water flow, or mechanical wear — check condenser water flow and descale; inspect for mechanical wear if water flow is normal.',
  },
  {
    condition: 'rising-normal-moderate',
    message: 'Temperature rising steadily with normal/moderate vibration.',
    recommendation:
      'Cooling/water flow restriction — check water supply pressure and condenser coil for scale buildup.',
  },
  {
    condition: 'dropping-critical',
    message: 'Temperature dropping abnormally with critical vibration.',
    recommendation:
      'Liquid refrigerant floodback or internal mechanical shock — inspect evaporator plate and expansion valve; schedule mechanical inspection.',
  },
  {
    condition: 'stable-critical',
    message: 'Temperature stable with critical vibration.',
    recommendation:
      'Loose mounting, worn grommets, or pipe resonance — inspect mounting bolts, rubber grommets, and refrigerant tubing for contact/looseness.',
  },
  {
    condition: 'slightly-elevated-moderate',
    message: 'Temperature stable and slightly elevated with moderate vibration.',
    recommendation:
      'Possible internal bearing/spring wear (early stage) — monitor closely; schedule inspection if the trend continues.',
  },
  {
    condition: 'rising-rapid-any',
    message: 'Temperature rising at a high rate (more than 5°C in a short window).',
    recommendation:
      'Electrical/power issue (capacitor, relay, voltage sag) — test start/run capacitor and contactor; check line voltage stability.',
  },
  {
    condition: 'no-reading-n-a',
    message: 'No reading received within the expected interval.',
    recommendation: 'Sensor/connectivity failure — check ESP32 power and WiFi connection.',
  },
];

export interface RecommendationInput {
  /** Temperature trend over the recent window. */
  temperatureTrend: TemperatureTrend;
  /** The fixed vibration band of the triggering reading. */
  vibrationBand: VibrationBand;
  /** True when no reading arrived within the expected interval (sensor offline). */
  noReading?: boolean;
}

export function getRecommendationForDetection(input: RecommendationInput): {
  message: string;
  recommendation: string;
} {
  const { temperatureTrend, vibrationBand, noReading } = input;

  // Sensor/connectivity failure takes precedence.
  if (noReading) {
    const t = recommendationTemplates.find((x) => x.condition === 'no-reading-n-a');
    if (!t) throw new Error('No recommendation template found.');
    return { message: t.message, recommendation: t.recommendation };
  }

  // Rapid rise beats everything else, for any vibration band.
  if (temperatureTrend === 'rising-rapid') {
    const t = recommendationTemplates.find((x) => x.condition === 'rising-rapid-any');
    if (!t) throw new Error('No recommendation template found.');
    return { message: t.message, recommendation: t.recommendation };
  }

  // Collapse the band into a template category.
  const bandKey: TemplateVibrationBand =
    vibrationBand === 'critical'
      ? 'critical'
      : vibrationBand === 'moderate'
      ? 'moderate'
      : 'normal-moderate';

  const trendKey =
    temperatureTrend === 'rising'
      ? 'rising'
      : temperatureTrend === 'dropping'
      ? 'dropping'
      : temperatureTrend === 'slightly-elevated'
      ? 'slightly-elevated'
      : 'stable';

  const key = `${trendKey}-${bandKey}`;
  const match = recommendationTemplates.find((t) => t.condition === key);
  if (match) return { message: match.message, recommendation: match.recommendation };

  const stableFallback = recommendationTemplates.find((t) => t.condition === `stable-${bandKey}`);
  if (stableFallback) {
    return { message: stableFallback.message, recommendation: stableFallback.recommendation };
  }

  const generic = recommendationTemplates.find((t) => t.condition === 'rising-normal-moderate');
  if (generic) return { message: generic.message, recommendation: generic.recommendation };
  throw new Error('No recommendation template found.');
}

// Backward-compatible helper for callers using the pre-step-2 signature.
export function getRecommendationForDetectionLegacy(
  trendDirection: 'increasing' | 'decreasing' | 'stable' | null,
  vibrationBand: VibrationBand
): { message: string; recommendation: string } {
  const trend: TemperatureTrend =
    trendDirection === 'increasing'
      ? 'rising'
      : trendDirection === 'decreasing'
      ? 'dropping'
      : 'stable';
  return getRecommendationForDetection({ temperatureTrend: trend, vibrationBand });
}