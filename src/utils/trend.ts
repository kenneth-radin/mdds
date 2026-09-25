import { TrendDirection, TrendInfo } from '../types';

interface Fit { slope: number; intercept: number; }

export function linearFit(values: number[], times: number[]): Fit {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };
  const meanX = times.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (times[i] - meanX) * (values[i] - meanY);
    den += (times[i] - meanX) * (times[i] - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

export function computeTrend(values: number[], timestamps: string[]): TrendInfo {
  if (values.length < 2) {
    return { direction: 'stable', slope: 0, pcChange: 0, text: 'Not enough historical readings to compute a trend.' };
  }
  const times = timestamps.map((t) => new Date(t).getTime() / 1000);
  const { slope, intercept } = linearFit(values, times);
  const span = Math.max(times[times.length - 1] - times[0], 1);
  const hourlySlope = slope * 3600;          // change per hour
  const step = span / Math.max(values.length - 1, 1); // average sample interval (s)
  const perStep = slope * step;              // change between two samples
  const first = values[0];
  const last = values[values.length - 1];
  const pcChange = first === 0 ? 0 : ((last - first) / first) * 100;
  let direction: TrendDirection = 'stable';
  const thresh = Math.max(Math.abs(perStep) * 0.12, 0.0005);
  if (perStep > thresh) direction = 'increasing';
  else if (perStep < -thresh) direction = 'decreasing';
  const dirText: Record<TrendDirection, string> = { increasing: 'increasing', decreasing: 'decreasing', stable: 'stable' };
  const text = `Trend is ${dirText[direction]} (delta ${pcChange >= 0 ? '+' : ''}${pcChange.toFixed(1)}% over the window, ~${hourlySlope.toFixed(3)}/hr).`;
  return { direction, slope: hourlySlope, pcChange: Math.round(pcChange * 10) / 10, text };
}

export function forecastLinear(y0: number, hourlySlope: number, hours: number): number {
  return y0 + hourlySlope * hours;
}