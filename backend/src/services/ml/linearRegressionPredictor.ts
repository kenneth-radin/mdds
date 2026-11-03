export interface TrendPrediction {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number; // per hour
  hoursUntilThreshold: number | null; // null if not increasing toward threshold
  predictedTempIn2h: number | null; // predicted temperature 2 hours ahead
}

/** Simple linear regression trend predictor for temperature time-series.
 *  Uses the last N readings to fit a line y = mx + b,
 *  then projects forward to estimate future values and time-to-threshold.
 */
export class LinearRegressionPredictor {
  private readonly window: number; // number of recent readings

  constructor(window: number = 10) {
    this.window = window;
  }

  /** Predict short-term trend based on recent readings.
   *  @param temperatures Array of recent temperature readings (most recent last)
   * @returns TrendPrediction with direction, slope, and projection info
   */
  predict(temperatures: number[]): TrendPrediction {
    if (temperatures.length < 3) {
      return { direction: 'stable', slope: 0, hoursUntilThreshold: null, predictedTempIn2h: null };
    }

    // Use the last `window` readings
    const data = temperatures.slice(0, this.window);
    const n = data.length;

    // Convert timestamps to seconds from the first reading
    // Assume readings are roughly evenly spaced (e.g., every 5 minutes)
    // For simplicity, use index as time proxy: t = 0, 1, 2, ...
    const sumX = (0 + (n - 1)) * n / 2; // sum of 0..n-1
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = data.reduce((acc, val, i) => acc + i * val, 0);
    const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6; // sum of squares 0..n-1

    const meanX = sumX / n;
    const meanY = sumY / n;

    // slope m = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX^2)
    const numerator = n * sumXY - sumX * sumY;
    const denominator = n * sumX2 - sumX * sumX;
    const m = denominator === 0 ? 0 : numerator / denominator; // per-index change

    // Convert to per-hour slope (assuming ~12 readings/hour = 5 min interval)
    // If we have N readings over T hours, slope_per_hour = m * (N / T)
    // Assuming 5-min intervals: 12 readings per hour
    const slopePerHour = m * 12;

    // Predict N steps ahead (2 hours = 24 steps at 5-min intervals)
    const stepsAhead = 24; // 2 hours * 12 readings/hour
    const lastTemp = data[data.length - 1];
    const predictedTempIn2h = lastTemp + slopePerHour * stepsAhead;

    // Determine direction
    const direction: 'increasing' | 'decreasing' | 'stable' =
      slopePerHour > 0.05 ? 'increasing' : slopePerHour < -0.05 ? 'decreasing' : 'stable';

    // Hours until threshold crossing (warning threshold = 85Â°C)
    const WARNING_THRESHOLD = 85;
    let hoursUntilThreshold: number | null = null;
    if (slopePerHour > 0 && lastTemp > WARNING_THRESHOLD) {
      // Already above warning â€“ but we compute how long until critical
      hoursUntilThreshold = null;
    } else if (slopePerHour > 0) {
      hoursUntilThreshold = (WARNING_THRESHOLD - lastTemp) / slopePerHour;
    }

    return {
      direction,
      slope: Number(slopePerHour.toFixed(4)),
      hoursUntilThreshold: hoursUntilThreshold !== null && hoursUntilThreshold !== Infinity && isFinite(hoursUntilThreshold) ? hoursUntilThreshold : null,
      predictedTempIn2h: Number(Number(predictedTempIn2h).toFixed(2)),
    };
  }
}
