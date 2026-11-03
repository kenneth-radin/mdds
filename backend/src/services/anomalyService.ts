import { SensorReading, ISensorReading } from '../models/SensorReading';
import { ZScoreConfig, MLService, MlAnomalyOutput } from '../services/ml';
import { classifyValue, DEFAULT_THRESHOLDS, worstCondition } from '../utils/helpers';

export class AnomalyDetector {
  private mlService: MLService;

  constructor() {
    // z-score config: window of 20 readings, z-threshold of 2.0, critical at 3.0
    const zConfig = {
      window: 20,
      zThreshold: 2.0,
      criticalZThreshold: 3.0,
    };
    this.mlService = new MLService({ zScore: zConfig, trendWindow: 10 });
  }

  analyze(
    reading: ISensorReading,
    history: ISensorReading[],
    thresholds: typeof DEFAULT_THRESHOLDS
  ): {} & {
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
  } {
    // Extract history arrays for the ML service
    const tempHistory = history
      .slice(-20)
      .filter((r) => r.temperature !== null && Number.isFinite(r.temperature))
      .map((r) => r.temperature);
    const vibHistory = history
      .slice(-20)
      .filter((r) => r.vibration !== null && Number.isFinite(r.vibration))
      .map((r) => r.vibration);

    // Use ML service for detection
    const mlOutput = this.mlService.detectAnomaly(
      reading.temperature,
      reading.vibration,
      tempHistory,
      vibHistory
    );

    // Build the result, merging ML output with threshold-based classification
    const baseResult: {} & {
      anomaly: boolean;
      severity: 'normal' | 'warning' | 'critical';
      parameter?: 'temperature' | 'vibration';
      reason?: string;
      suggestion?: string;
    } = {
      anomaly: mlOutput.anomaly,
      severity: mlOutput.severity,
      parameter: mlOutput.parameter,
      reason: mlOutput.reason,
      suggestion: mlOutput.suggestion,
    };

    // Add model-specific fields
    const result = {
      ...baseResult,
      model: mlOutput.model,
      score: mlOutput.score,
      confidence: mlOutput.confidence,
    };

    // Add trend info if available
    if (mlOutput.hoursUntilThreshold !== undefined) {
      ;(result as any).hoursUntilThreshold = mlOutput.hoursUntilThreshold;
      ;(result as any).predictedTempIn2h = mlOutput.predictedTempIn2h;
      ;(result as any).trendDirection = mlOutput.trendDirection;
      ;(result as any).trendSlope = mlOutput.trendSlope;
    }

    // Also keep backward compatibility: if ML says no anomaly but thresholds say critical,
    // use the threshold result as fallback
    if (!mlOutput.anomaly) {
      // Classify using thresholds as a secondary check
      const tempLevel = classifyValue(thresholds.temperature, reading.temperature);
      const vibLevel = classifyValue(thresholds.vibration, reading.vibration);
      const worstLevel = worstCondition([tempLevel, vibLevel] as any);

      if (worstLevel === 'critical') {
        return {
          anomaly: true,
          severity: 'critical',
          parameter: 'temperature',
          reason: `Temperature ${reading.temperature.toFixed(1)}Â°C is in the critical band.`,
          suggestion: 'Inspect cooling system immediately â€” temperature is critical.',
          model: 'rule-based',
        };
      } else if (worstLevel === 'warning') {
        return {
          anomaly: true,
          severity: 'warning',
          parameter: reading.temperature > reading.vibration ? 'temperature' : 'vibration',
          reason: `${reading.temperature.toFixed(1)}Â°C or ${reading.vibration.toFixed(1)}mm/s is in the warning band.`,
          suggestion: worstLevel === 'warning'
            ? 'Inspect cooling system and check bearing wear.'
            : 'Continue routine monitoring.',
          model: 'rule-based',
        };
      }
    }

    return result;
  }
}
