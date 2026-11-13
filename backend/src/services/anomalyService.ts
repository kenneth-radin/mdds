import { ISensorReading } from '../models/SensorReading';
import { ZScoreConfig, MLService, MlAnomalyOutput } from '../services/ml';
import { DEFAULT_THRESHOLDS, worstCondition, type Level } from '../utils/helpers';
import {
  classifyVibrationBand,
  vibrationBandSeverity,
  VibrationBand,
} from './detectionFeatures';

export interface AnomalyDetection {
  anomaly: boolean;
  severity: 'normal' | 'warning' | 'critical';
  parameter?: 'temperature' | 'vibration';
  reason?: string;
  suggestion?: string;
  model: 'z-score' | 'linear-regression' | 'rule-based';
  score?: number;
  confidence?: number;
  hoursUntilThreshold?: number;
  predictedTempIn2h?: number;
  trendDirection?: 'increasing' | 'decreasing' | 'stable';
  trendSlope?: number;
  vibrationBand?: VibrationBand;
  /** The temperature z-score the detector computed (for reporting/verification). */
  temperatureZ?: number;
  /** The vibration z-score the detector computed (for reporting/verification). */
  vibrationZ?: number;
}

/** Population mean + std over a window; std floors at 1.0 (matches ZScoreDetector). */
function computeStats(values: number[]): { mean: number; std: number } | null {
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.max(Math.sqrt(variance), 1.0);
  return { mean, std };
}

export class AnomalyDetector {
  private mlService: MLService;
  /** Fixed vibration band of the most recently analyzed reading (step 1). */
  private floorBand: VibrationBand = 'idle';

  constructor() {
    // z-score config: window of 20 readings. Warning at z >= 2.5, critical at
    // z >= 3.5. The critical threshold was originally 3.0, but a dry-run of the
    // fabricated ice-maker seed data showed false positives on normal operating
    // variation; 3.5 cleared them (see the seed verification script).
    const zConfig: ZScoreConfig = {
      window: 20,
      zThreshold: 2.5,
      criticalZThreshold: 3.5,
    };
    this.mlService = new MLService({ zScore: zConfig, trendWindow: 10 });
  }

  get lastVibrationBand(): VibrationBand {
    return this.floorBand;
  }

  analyze(
    reading: ISensorReading,
    history: ISensorReading[],
    thresholds: typeof DEFAULT_THRESHOLDS
  ): AnomalyDetection {
    const tempHistory = history
      .slice(-20)
      .filter((r) => r.temperature !== null && Number.isFinite(r.temperature))
      .map((r) => r.temperature);
    const vibHistory = history
      .slice(-20)
      .filter((r) => r.vibration !== null && Number.isFinite(r.vibration))
      .map((r) => r.vibration);

    const mlOutput: MlAnomalyOutput = this.mlService.detectAnomaly(
      reading.temperature,
      reading.vibration,
      tempHistory,
      vibHistory
    );

    // Compute the two z-scores for reporting (same population-std formula as
    // the real ZScoreDetector, over the same 20-reading window).
    const tempStats = computeStats(tempHistory);
    const vibStats = computeStats(vibHistory);
    const temperatureZ = tempStats
      ? Math.abs(reading.temperature - tempStats.mean) / tempStats.std
      : null;
    const vibrationZ = vibStats
      ? Math.abs(reading.vibration - vibStats.mean) / vibStats.std
      : null;

    // --- Fixed vibration band: severity floor for the vibration axis. ---
    this.floorBand = classifyVibrationBand(reading.vibration);
    const bandSeverity: Level = vibrationBandSeverity(this.floorBand);
    const bandActive = bandSeverity !== 'normal';

    // --- Temperature severity from the z-score/trend layer. ---
    let tempSeverity: Level = 'normal';
    if (mlOutput.anomaly && mlOutput.parameter === 'temperature') {
      tempSeverity = mlOutput.severity;
    }

    // Legacy high-temperature safety net (85°C). Ice-maker data stays far below.
    const tempThresholdLevel: Level =
      reading.temperature >= thresholds.temperature * 1.2
        ? 'critical'
        : reading.temperature >= thresholds.temperature * 0.8
        ? 'warning'
        : 'normal';
    tempSeverity = worstCondition([tempSeverity, tempThresholdLevel]);

    // --- Final severity: worst of temperature axis and vibration band floor. ---
    const finalSeverity = worstCondition([tempSeverity, bandSeverity]);
    const anomaly = finalSeverity !== 'normal';

    if (!anomaly) {
      return {
        anomaly: false,
        severity: 'normal',
        model: mlOutput.model,
        confidence: 0,
      };
    }

    let parameter: 'temperature' | 'vibration';
    let reason: string;
    let suggestion: string;

    if (bandActive && bandSeverity === worstCondition([tempSeverity, bandSeverity])) {
      parameter = 'vibration';
      reason =
        `Vibration ${reading.vibration.toFixed(1)} on the 0-20 scale is in the ${this.floorBand} band` +
        ` (floor severity: ${bandSeverity}).`;
      suggestion =
        this.floorBand === 'critical'
          ? 'Check condenser water flow / mounting / bearings — vibration is critically high.'
          : 'Monitor vibration closely and schedule inspection if the trend continues.';
    } else {
      parameter = 'temperature';
      if (tempThresholdLevel !== 'normal') {
        reason = `Temperature ${reading.temperature.toFixed(1)}°C is in the ${tempThresholdLevel} range.`;
        suggestion =
          tempThresholdLevel === 'critical'
            ? 'Inspect cooling system — temperature is critical.'
            : 'Inspect cooling system — temperature is elevated.';
      } else if (mlOutput.reason) {
        reason = mlOutput.reason;
        suggestion = mlOutput.suggestion ?? 'Inspect cooling system.';
      } else {
        reason = `Temperature deviation from recent baseline (z-score ${(mlOutput.score ?? 0).toFixed(2)}).`;
        suggestion = 'Inspect cooling system — temperature deviation detected.';
      }
    }

    const result: AnomalyDetection = {
      anomaly: true,
      severity: finalSeverity,
      parameter,
      reason,
      suggestion,
      model: mlOutput.model,
      score: mlOutput.score,
      confidence: mlOutput.confidence,
    };
    if (bandActive) result.vibrationBand = this.floorBand;
    if (temperatureZ !== null) result.temperatureZ = temperatureZ;
    if (vibrationZ !== null) result.vibrationZ = vibrationZ;
    if (mlOutput.hoursUntilThreshold !== undefined) {
      result.hoursUntilThreshold = mlOutput.hoursUntilThreshold;
      result.predictedTempIn2h = mlOutput.predictedTempIn2h;
      result.trendDirection = mlOutput.trendDirection;
      result.trendSlope = mlOutput.trendSlope;
    }

    return result;
  }
}