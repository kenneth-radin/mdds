/**
 * Loader for the AI4I 2020 Predictive Maintenance dataset (UCI ML Repository).
 *
 * HONESTY NOTES — read before using anything this file produces:
 *
 * 1. The dataset is SYNTHETIC. UCI describes it as "a synthetic dataset that
 *    reflects real predictive maintenance data encountered in industry". It is
 *    not sensor data from this college's machines and must never be presented
 *    as such.
 * 2. The failure-mode labels are deterministic functions of the input features,
 *    as documented by the dataset itself (e.g. HDF fires when the process-air
 *    temperature gap is below 8.6 K and speed below 1380 rpm). This model
 *    therefore demonstrates that the pipeline *learns documented relationships*
 *    and produces reproducible metrics — it is NOT evidence of predictive skill
 *    on real plant equipment.
 * 3. Rows can carry more than one failure mode simultaneously (24 of 10,000 do),
 *    so the problem is modelled as MULTI-LABEL: five independent binary
 *    classifiers, never a single mutually-exclusive softmax.
 * 4. The CSV is used only to train and evaluate a model. Its rows are never
 *    written into the plant database as machines or maintenance records.
 *
 * Source: https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset
 * Citation: AI4I 2020 Predictive Maintenance Dataset [Dataset]. (2020). UCI ML Repository.
 *           https://doi.org/10.24432/C5HS5C   — License: CC BY 4.0
 */
import * as fs from 'fs';
import * as path from 'path';

/** The five independent failure-mode indicators in the dataset. */
export const FAILURE_MODES = ['TWF', 'HDF', 'PWF', 'OSF', 'RNF'] as const;
export type FailureMode = (typeof FAILURE_MODES)[number];

export const FAILURE_MODE_MEANINGS: Record<FailureMode, string> = {
  TWF: 'Tool wear failure',
  HDF: 'Heat dissipation failure',
  PWF: 'Power failure',
  OSF: 'Overstrain failure',
  RNF: 'Random failure'
};

/**
 * Feature columns, in the exact order used for training and inference.
 *
 * The first 8 are published dataset columns (air/process temperature, speed,
 * torque, tool wear, plus the L/M/H product type one-hot encoded).
 *
 * The last 3 are PHYSICS-INFORMED DERIVED features. They mirror the failure
 * mechanisms the dataset documentation describes (temperature gap, mechanical
 * power, wear x strain). They are declared a priori from the published
 * documentation — they are not fitted from the labels — and they are listed
 * here so the model card can state exactly what the model was given.
 */
export const FEATURE_NAMES = [
  'airTemperatureK',
  'processTemperatureK',
  'rotationalSpeedRpm',
  'torqueNm',
  'toolWearMin',
  'productTypeL',
  'productTypeM',
  'productTypeH',
  'temperatureGapK',
  'mechanicalPowerW',
  'wearStrainMinNm'
] as const;

export interface Ai4iRow {
  features: number[];
  /** True when `Machine failure` == 1. */
  failed: boolean;
  /** One entry per failure-mode column; parallel to FAILURE_MODES. */
  targets: number[];
}

function resolveCsvPath(): string {
  // Works identically under `tsx` (src/services/ml) and compiled output (dist/services/ml).
  const candidates = [
    path.resolve(__dirname, '../../../data/ai4i2020.csv'),
    path.resolve(__dirname, '../../data/ai4i2020.csv'),
    path.resolve(process.cwd(), 'backend/data/ai4i2020.csv')
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `AI4I dataset not found. Looked in: ${candidates.join(', ')}. ` +
        'Expected backend/data/ai4i2020.csv (see backend/data/ATTRIBUTION.md).'
    );
  }
  return found;
}


export function ai4iCsvPath(): string {
  return resolveCsvPath();
}

/** The six published operating parameters, exactly as a technician would enter them. */
export interface OperatingParameters {
  airTemperatureK: number;
  processTemperatureK: number;
  rotationalSpeedRpm: number;
  torqueNm: number;
  toolWearMin: number;
  productType: 'L' | 'M' | 'H';
}

/**
 * Builds the 11-column feature vector from user-entered parameters.
 * Identical arithmetic to loadAi4iRows so training and inference can never drift
 * apart — a silent mismatch there would produce confident nonsense predictions.
 */
export function buildFeatureVector(input: OperatingParameters): number[] {
  return [
    input.airTemperatureK,
    input.processTemperatureK,
    input.rotationalSpeedRpm,
    input.torqueNm,
    input.toolWearMin,
    input.productType === 'L' ? 1 : 0,
    input.productType === 'M' ? 1 : 0,
    input.productType === 'H' ? 1 : 0,
    input.processTemperatureK - input.airTemperatureK,
    (input.torqueNm * input.rotationalSpeedRpm * 2 * Math.PI) / 60,
    input.toolWearMin * input.torqueNm
  ];
}


/** Parses the CSV into numeric feature rows plus multi-label targets. */
export function loadAi4iRows(csvPath: string = resolveCsvPath()): Ai4iRow[] {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('AI4I CSV contains no data rows.');

  const header = lines[0].split(',');
  const expected = [
    'UDI',
    'Product ID',
    'Type',
    'Air temperature [K]',
    'Process temperature [K]',
    'Rotational speed [rpm]',
    'Torque [Nm]',
    'Tool wear [min]',
    'Machine failure',
    'TWF',
    'HDF',
    'PWF',
    'OSF',
    'RNF'
  ];
  if (header.length !== expected.length) {
    throw new Error(`Unexpected AI4I CSV layout: ${header.length} columns, expected ${expected.length}.`);
  }

  const rows: Ai4iRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(',');
    if (cells.length !== expected.length) {
      throw new Error(`Row ${i} has ${cells.length} cells, expected ${expected.length}.`);
    }

    const airTemperature = Number(cells[3]);
    const processTemperature = Number(cells[4]);
    const speedRpm = Number(cells[5]);
    const torque = Number(cells[6]);
    const toolWear = Number(cells[7]);
    const type = cells[2];

    const features = [
      airTemperature,
      processTemperature,
      speedRpm,
      torque,
      toolWear,
      type === 'L' ? 1 : 0,
      type === 'M' ? 1 : 0,
      type === 'H' ? 1 : 0,
      // Physics-informed derivations, per the dataset documentation.
      processTemperature - airTemperature,
      (torque * speedRpm * 2 * Math.PI) / 60,
      toolWear * torque
    ];

    if (!features.every((value) => Number.isFinite(value))) {
      throw new Error(`Row ${i} produced a non-finite feature value.`);
    }

    const targets = FAILURE_MODES.map((_, offset) => Number(cells[9 + offset]) === 1 ? 1 : 0);
    rows.push({ features, failed: Number(cells[8]) === 1, targets });
  }

  return rows;
}
