import { ZScoreDetector, ZScoreConfig } from './zScoreDetector';
import { LinearRegressionPredictor, TrendPrediction } from './linearRegressionPredictor';

export { ZScoreDetector, ZScoreConfig };
export { LinearRegressionPredictor, TrendPrediction };

export interface MlAnomalyOutput {
  anomaly: boolean;
  severity: 'normal' | 'warning' | 'critical';
  parameter?: 'temperature' | 'vibration';
  reason?: string;
  suggestion?: string;
  model: 'z-score' | 'linear-regression';
  score?: number;
  confidence?: number;
  hoursUntilThreshold?: number;
  predictedTempIn2h?: number;
  trendDirection?: 'increasing' | 'decreasing' | 'stable';
  trendSlope?: number;
}

export interface MlPredictionInput {
  temperature: number;
  vibration: number;
  tempHistory: number[]; // recent temperatures (most recent last)
  vibHistory: number[]; // recent vibrations (most recent last)
}

/** Unified ML service that combines z-score anomaly detection and trend prediction.
 *  Stage 1: unsupervised z-score detection on recent baseline.
 *  Stage 2: linear regression trend prediction for short-term forecasting.
 *  Designed so the rest of the app only needs to call detectAnomaly() and predictTrend(),
 *  without caring whether the underlying method is rule-based, statistical, or ML.
 */
export class MLService {
  private zScore: ZScoreDetector;
  private trend: LinearRegressionPredictor;

  constructor(config: { zScore: ZScoreConfig; trendWindow: number }) {
    this.zScore = new ZScoreDetector(config.zScore);
    this.trend = new LinearRegressionPredictor(config.trendWindow);
  }

  /** Detect anomaly in the current reading based on historical data.
   *  Returns expanded output including model, score, confidence, and trend info.
   */
  detectAnomaly(
    temp: number,
    vib: number,
    tempHistory: number[],
    vibHistory: number[]
  ): MlAnomalyOutput {
    // Stage 1: z-score anomaly detection
    const zResult = this.zScore.detect(temp, vib, tempHistory, vibHistory);

    // Stage 2: trend prediction
    const tempHistoryForTrend = tempHistory.length > 0 ? tempHistory : [];
    const trendResult = this.trend.predict(tempHistoryForTrend);

    // Build output, merging z-score + trend results
    const output: MlAnomalyOutput = {
      anomaly: zResult.anomaly,
      severity: zResult.severity,
      model: zResult.model,
      parameter: zResult.parameter,
      reason: zResult.reason,
      suggestion: zResult.suggestion,
      score: zResult.score,
      confidence: zResult.confidence,
    };

    // Append trend info if available
    if (trendResult.hoursUntilThreshold !== null) {
      output.hoursUntilThreshold = trendResult.hoursUntilThreshold ?? undefined;
      output.predictedTempIn2h = trendResult.predictedTempIn2h ?? undefined;
      output.trendDirection = trendResult.direction;
      output.trendSlope = trendResult.slope;
    }

    // If trend suggests approaching threshold and no z-score anomaly yet,
    // surface as a warning anomaly
    if (
      trendResult.hoursUntilThreshold !== null &&
      trendResult.hoursUntilThreshold <= 2 &&
      !zResult.anomaly
    ) {
      return {
        anomaly: true,
        severity: 'warning',
        parameter: 'temperature',
        reason: `Temperature likely to cross warning threshold in ${trendResult.hoursUntilThreshold.toFixed(
          1
        )} hours based on current trend.`,
        suggestion: `Inspect cooling system â€” temperature projected to reach warning level in ${trendResult.hoursUntilThreshold.toFixed(
          1
        )} hours.`,
        model: 'linear-regression',
        confidence: 70,
        hoursUntilThreshold: trendResult.hoursUntilThreshold ?? undefined,
        predictedTempIn2h: trendResult.predictedTempIn2h ?? undefined,
        trendDirection: trendResult.direction,
        trendSlope: trendResult.slope,
      };
    }

    return output;
  }

  /** Predict trend based on recent readings */
  predictTrend(tempHistory: number[]): TrendPrediction {
    return this.trend.predict(tempHistory);
  }
}
