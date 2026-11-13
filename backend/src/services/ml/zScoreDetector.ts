export interface ZScoreConfig {
  window: number; // number of recent readings to use for baseline
  zThreshold: number; // z-score threshold for anomaly (e.g., 2.0)
  criticalZThreshold: number; // z-score threshold for critical anomaly (e.g., 3.0)
}

/** Rolling z-score anomaly detector for sensor data.
 *  Tracks mean and std dev over a sliding window of recent readings.
 *  No training data needed – adapts automatically as new readings flow.
 */
export class ZScoreDetector {
  private tempWindow: number[] = [];
  private vibWindow: number[] = [];
  private config: ZScoreConfig;

  constructor(config: ZScoreConfig) {
    this.config = config;
  }

  /** Add a new reading to the windows. */
  addReading(temp: number, vib: number): void {
    if (temp !== null && Number.isFinite(temp)) this.tempWindow.push(temp);
    if (vib !== null && Number.isFinite(vib)) this.vibWindow.push(vib);
    // Keep window size bounded
    if (this.tempWindow.length > this.config.window)
      this.tempWindow.splice(0, this.tempWindow.length - this.config.window);
    if (this.vibWindow.length > this.config.window)
      this.vibWindow.splice(0, this.vibWindow.length - this.config.window);
  }

  /** Compute population mean and std dev for a window. */
  private computeStats(values: number[]): { mean: number; std: number } | null {
    if (values.length < 3) return null;
    const mean =
      values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    // Floor the standard deviation at 1.0. A freshly-reset baseline (the first
    // few operating readings after a startup) has near-zero variance, which
    // would otherwise inflate z-scores to false-positive levels. The old
    // `|| 1` only caught an exactly-zero variance; this guards tiny-but-nonzero
    // variance too. This is a detector-stability floor, not data manipulation.
    const std = Math.max(Math.sqrt(variance), 1.0);
    return { mean, std };
  }

  /** Detect anomaly for a single reading.
   *  Returns { anomaly, severity, parameter, reason, suggestion, model, score, confidence }
   *  or { anomaly: false, severity: 'normal', model: 'z-score', confidence: 0 } if no anomaly.
   */
  detect(temp: number, vib: number, historyT: number[], historyV: number[]): {
    anomaly: boolean;
    severity: 'normal' | 'warning' | 'critical';
    parameter?: 'temperature' | 'vibration';
    reason?: string;
    suggestion?: string;
    model: 'z-score';
    score?: number;
    confidence?: number;
  } {
    // Start with normal state
    let anomaly = false;
    let severity: 'normal' | 'warning' | 'critical' = 'normal';
    let parameter: 'temperature' | 'vibration' | undefined;
    let reason: string | undefined;
    let suggestion: string | undefined;
    let score: number | undefined;
    let confidence: number | undefined;

    // Check temperature z-score
    const tempStats = this.computeStats(historyT);
    if (tempStats) {
      const zTemp = Math.abs(temp - tempStats.mean) / tempStats.std;
      if (zTemp >= this.config.criticalZThreshold) {
        anomaly = true;
        severity = 'critical';
        parameter = 'temperature';
        reason = `Temperature z-score ${zTemp.toFixed(2)} — critical deviation from recent baseline.`;
        suggestion = `Inspect cooling system immediately — temperature deviation critical (z-score: ${zTemp.toFixed(2)}).`;
        score = zTemp;
        confidence = Math.min(100, Math.round(zTemp * 10));
      } else if (zTemp >= this.config.zThreshold) {
        anomaly = true;
        severity = 'warning';
        parameter = 'temperature';
        reason = `Temperature z-score ${zTemp.toFixed(2)} — deviation from recent baseline.`;
        suggestion = `Inspect cooling system — temperature deviation detected (z-score: ${zTemp.toFixed(2)}).`;
        score = zTemp;
        confidence = Math.min(100, Math.round(zTemp * 10));
      }
    }

    // Check vibration z-score (only if not already critical from temp)
    if (!anomaly || severity !== 'critical') {
      const vibStats = this.computeStats(historyV);
      if (vibStats) {
        const zVib = Math.abs(vib - vibStats.mean) / vibStats.std;
        if (zVib >= this.config.criticalZThreshold) {
          if (!anomaly || severity !== 'critical') {
            anomaly = true;
            severity = 'critical';
            parameter = 'vibration';
            reason = `Vibration z-score ${zVib.toFixed(2)} — critical deviation from recent baseline.`;
            suggestion = `Check bearing wear and lubrication immediately — vibration deviation critical (z-score: ${zVib.toFixed(2)}).`;
            score = zVib;
            confidence = Math.min(100, Math.round(zVib * 10));
          }
        } else if (zVib >= this.config.zThreshold && !anomaly) {
          anomaly = true;
          severity = 'warning';
          parameter = 'vibration';
          reason = `Vibration z-score ${zVib.toFixed(2)} — deviation from recent baseline.`;
          suggestion = `Check bearing wear and lubrication — vibration deviation detected (z-score: ${zVib.toFixed(2)}).`;
          score = zVib;
          confidence = Math.min(100, Math.round(zVib * 10));
        }
      }
    }

    if (!anomaly) {
      return { anomaly: false, severity: 'normal', model: 'z-score', confidence: 0 };
    }

    return { anomaly, severity, parameter, reason, suggestion, model: 'z-score', score, confidence };
  }
}