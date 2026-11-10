/**
 * Recommendation templates keyed to detectable anomaly patterns.
 *
 * These are human-readable recommendations for z-score + trend anomaly
 * detections. They do NOT depend on the AI4I logistic regression models or
 * the TF-IDF comparable-case service, both of which require sensor features
 * (torque, RPM, process temperature, tool wear) that the ESP32 does not collect.
 *
 * Templates are keyed by a combination of:
 *   - parameter: 'temperature' | 'vibration' | null
 *   - severity: 'warning' | 'critical'
 *   - trendDirection: 'increasing' | 'decreasing' | 'stable' | null
 *
 * Future improvement: once real labeled failure outcomes accumulate,
 * replace these static templates with data-driven recommendations.
 */

export interface RecommendationTemplate {
  condition: string;
  message: string;
  recommendation: string;
}

export const recommendationTemplates: RecommendationTemplate[] = [
  // Temperature + Vibration both anomalous
  {
    condition: 'temp-vib-critical-increasing',
    message: 'Temperature and vibration both critical — immediate mechanical stress likely.',
    recommendation: 'Possible mechanical issue — vibration and temperature trending abnormally together, recommend inspection.'
  },
  {
    condition: 'temp-vib-warning-increasing',
    message: 'Temperature and vibration both elevated — monitor closely.',
    recommendation: 'Vibration and temperature both in warning band — schedule inspection within 24 hours.'
  },
  // Temperature only
  {
    condition: 'temp-critical-stable',
    message: 'Temperature critical without vibration correlation.',
    recommendation: 'Temperature anomaly without vibration correlation — check cooling/ventilation system immediately.'
  },
  {
    condition: 'temp-critical-increasing',
    message: 'Temperature critical and rising.',
    recommendation: 'Temperature critical with upward trend — inspect cooling system immediately, risk of overheating.'
  },
  {
    condition: 'temp-warning-stable',
    message: 'Temperature elevated but stable.',
    recommendation: 'Temperature in warning band — check coolant levels and airflow.'
  },
  {
    condition: 'temp-warning-increasing',
    message: 'Temperature rising toward critical.',
    recommendation: 'Temperature trending upward — monitor closely, may indicate early-stage cooling issue.'
  },
  // Vibration only
  {
    condition: 'vib-critical-stable',
    message: 'Vibration critical without temperature correlation.',
    recommendation: 'Vibration anomaly without temperature correlation — check bearing wear and lubrication immediately.'
  },
  {
    condition: 'vib-critical-increasing',
    message: 'Vibration critical and rising.',
    recommendation: 'Vibration critical with upward trend — inspect bearings and mounting, risk of mechanical failure.'
  },
  {
    condition: 'vib-warning-stable',
    message: 'Vibration elevated but stable.',
    recommendation: 'Vibration in warning band — check for loose components or imbalance.'
  },
  {
    condition: 'vib-warning-increasing',
    message: 'Vibration rising toward critical.',
    recommendation: 'Vibration trending upward — monitor closely, may indicate early-stage bearing wear.'
  },
  // Trend-only (no single-point z-score breach yet)
  {
    condition: 'trend-increasing-normal',
    message: 'Gradual temperature drift detected.',
    recommendation: 'Gradual temperature drift detected — monitor closely, may indicate early-stage wear or fouling.'
  },
  {
    condition: 'trend-decreasing-normal',
    message: 'Gradual temperature decrease detected.',
    recommendation: 'Temperature trending downward — verify sensor calibration and cooling system operation.'
  },
  // Fallback
  {
    condition: 'default',
    message: 'Sensor anomaly detected.',
    recommendation: 'Review sensor readings and machine condition — consult maintenance procedures.'
  }
];

export function getRecommendationForDetection(
  parameter: 'temperature' | 'vibration' | null,
  severity: 'normal' | 'warning' | 'critical',
  trendDirection: 'increasing' | 'decreasing' | 'stable' | null
): { message: string; recommendation: string } {
  // Build a condition key from the detection parameters
  const paramLabel = parameter === 'temperature' ? 'temp' : parameter === 'vibration' ? 'vib' : 'default';
  const sevLabel = severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : 'normal';
  const trendLabel = trendDirection === 'increasing' ? 'increasing' : trendDirection === 'decreasing' ? 'decreasing' : 'stable';

  // Try specific combinations first
  const specificKey = `${paramLabel}-${sevLabel}-${trendLabel}`;
  const specific = recommendationTemplates.find(t => t.condition === specificKey);
  if (specific) return { message: specific.message, recommendation: specific.recommendation };

  // Fall back to parameter + severity without trend
  const paramSevKey = `${paramLabel}-${sevLabel}-stable`;
  const paramSev = recommendationTemplates.find(t => t.condition === paramSevKey);
  if (paramSev) return { message: paramSev.message, recommendation: paramSev.recommendation };

  // Fall back to parameter-only
  const paramKey = `${paramLabel}-warning-stable`;
  const paramOnly = recommendationTemplates.find(t => t.condition === paramKey);
  if (paramOnly) return { message: paramOnly.message, recommendation: paramOnly.recommendation };

  // Ultimate fallback
  const fallback = recommendationTemplates.find(t => t.condition === 'default');
  if (!fallback) throw new Error('No fallback recommendation template found');
  return { message: fallback.message, recommendation: fallback.recommendation };
}