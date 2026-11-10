#!/usr/bin/env tsx
import { AnomalyDetector } from '../src/services/anomalyService';
import { DEFAULT_THRESHOLDS } from '../src/utils/helpers';
import { getRecommendationForDetection } from '../src/services/recommendationTemplates';

function makeReading(temperature: number, vibration: number, dateOffsetMin: number = 0): any {
  return {
    _id: 'mock-' + Date.now(),
    machine: 'CMP-001',
    date: Date.now() - dateOffsetMin * 60 * 1000,
    temperature,
    vibration,
    operatingHours: 1000,
    source: 'device',
    syncedToFirebase: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

let alerts: any[] = [];

function simulateAlertCreate(reading: any, detection: any): { created: boolean; alert?: any; reason?: string } {
  const { message, recommendation } = getRecommendationForDetection(
    detection.parameter ?? null,
    detection.severity,
    detection.trendDirection ?? 'stable'
  );
  const existingAlert = alerts.find(
    (a) => a.machine === reading.machine && a.parameter === (detection.parameter ?? null) && a.severity === detection.severity && !a.resolved
  );
  if (existingAlert) {
    return { created: false, reason: `Duplicate suppressed: unresolved ${detection.severity} alert for ${detection.parameter} already exists` };
  }
  const alert = {
    _id: 'alert-' + Date.now(),
    machine: reading.machine,
    parameter: detection.parameter ?? null,
    zScore: detection.score ?? null,
    trendDirection: detection.trendDirection ?? null,
    severity: detection.severity,
    message: message || detection.reason || 'Sensor anomaly detected.',
    recommendation: recommendation || detection.suggestion || 'Review sensor readings.',
    triggeredAt: reading.date,
    resolved: false,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  alerts.push(alert);
  return { created: true, alert };
// -----------------------------------------------------------
// Test 1: Critical temperature spike → should create alert
// -----------------------------------------------------------
console.log('=== Test 1: Critical temperature spike ===\n');

const history1 = [
  makeReading(70, 2.0, 20),
  makeReading(71, 2.1, 15),
  makeReading(72, 2.0, 10),
  makeReading(73, 2.2, 5),
];
const reading1 = makeReading(95, 2.0, 0);
const detector1 = new AnomalyDetector();
const detection1 = detector1.analyze(reading1, history1, DEFAULT_THRESHOLDS);

console.log('Reading:', { temperature: reading1.temperature, vibration: reading1.vibration });
console.log('Detection:', JSON.stringify(detection1, null, 2));

const result1 = simulateAlertCreate(reading1, detection1);
console.log('Alert created:', result1.created);
// -----------------------------------------------------------
// Test 2: Same critical temperature → duplicate suppressed
// -----------------------------------------------------------
console.log('=== Test 2: Same critical temperature (duplicate suppression) ===\n');

const reading2 = makeReading(96, 2.0, 0);
const detector2 = new AnomalyDetector();
const detection2 = detector2.analyze(reading2, history1, DEFAULT_THRESHOLDS);

console.log('Reading:', { temperature: reading2.temperature, vibration: reading2.vibration });
console.log('Detection:', JSON.stringify(detection2, null, 2));

const result2 = simulateAlertCreate(reading2, detection2);
console.log('Alert created:', result2.created);
if (!result2.created) {
  console.log('Suppression reason:', result2.reason);
// -----------------------------------------------------------
// Test 3: Critical vibration → separate alert (different parameter)
// -----------------------------------------------------------
console.log('=== Test 3: Critical vibration (different parameter, new alert) ===\n');

const reading3 = makeReading(70, 6.0, 0);
const detector3 = new AnomalyDetector();
const detection3 = detector3.analyze(reading3, history1, DEFAULT_THRESHOLDS);

console.log('Reading:', { temperature: reading3.temperature, vibration: reading3.vibration });
console.log('Detection:', JSON.stringify(detection3, null, 2));

const result3 = simulateAlertCreate(reading3, detection3);
console.log('Alert created:', result3.created);
if (result3.alert) {
  console.log('Alert message:', result3.alert.message);
  console.log('Alert recommendation:', result3.alert.recommendation);
  console.log('Alert severity:', result3.alert.severity);
  console.log('Alert parameter:', result3.alert.parameter);
}
console.log();

// -----------------------------------------------------------
// Test 4: Normal readings → no anomaly, no alert
// -----------------------------------------------------------
console.log('=== Test 4: Normal readings → no anomaly ===\n');

const history4 = [
  makeReading(70, 2.0, 20),
  makeReading(71, 2.1, 15),
  makeReading(72, 2.0, 10),
];
const reading4 = makeReading(72, 2.2, 0);
const detector4 = new AnomalyDetector();
const detection4 = detector4.analyze(reading4, history4, DEFAULT_THRESHOLDS);

console.log('Reading:', { temperature: reading4.temperature, vibration: reading4.vibration });
console.log('Detection:', JSON.stringify(detection4, null, 2));
console.log('Anomaly detected:', detection4.anomaly);
if (!detection4.anomaly) {
  console.log('→ No alert created (normal operating range)');
}
console.log();

// -----------------------------------------------------------
// Summary
// -----------------------------------------------------------
console.log('=== Summary ===');
console.log(`Total alerts created: ${alerts.filter((a) => !a.resolved).length}`);
for (const a of alerts) {
  if (!a.resolved) {
    console.log(`  - ${a.severity.toUpperCase()} ${a.parameter}: ${a.message}`);
    console.log(`    Recommendation: ${a.recommendation}`);
  }
}
console.log('\n✓ Pipeline test complete.');
}
console.log();
if (result1.alert) {
  console.log('Alert message:', result1.alert.message);
  console.log('Alert recommendation:', result1.alert.recommendation);
  console.log('Alert severity:', result1.alert.severity);
  console.log('Alert parameter:', result1.alert.parameter);
}
console.log();
}