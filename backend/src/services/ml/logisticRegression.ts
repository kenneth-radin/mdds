/**
 * Layer 2 / 3 engine — multinomial logistic regression via one-vs-rest.
 *
 * Implemented in plain TypeScript rather than pulled in from an ML package for
 * three reasons specific to this project:
 *   1. The capstone needs the decision rule to be explainable; gradient descent
 *      on six features can be described in a defence. A black-box dependency
 *      cannot.
 *   2. The backend deploys to Render from a small tsconfig build; adding a
 *      TensorFlow.js dependency for six features would multiply the image size
 *      for no measurable gain.
 *   3. Deterministic given a fixed input order — the same training set always
 *      yields the same weights, so reported metrics are reproducible.
 *
 * Everything here is real supervised learning: features are standardised from
 * the training split only, weights are fitted by gradient descent with L2
 * regularisation, and evaluation uses a stratified held-out fold.
 */

export interface LogisticRegressionModel {
  kind: 'logistic-regression';
  /** Sorted class labels; weights[i] predicts labels[i]. */
  labels: string[];
  /** Name of each input column, surfaced on the model card. */
  featureNames: string[];
  /** Per-feature standardisation computed from the TRAINING split only. */
  featureMean: number[];
  featureStd: number[];
  /** One weight vector per class (one-vs-rest). */
  weights: number[][];
  bias: number[];
  training: {
    samples: number;
    features: number;
    classes: number;
    epochs: number;
    learningRate: number;
    l2: number;
    /** Epoch at which the update norm fell below tolerance. */
    stoppedAtEpoch: number;
  };
}

export interface FitOptions {
  epochs?: number;
  learningRate?: number;
  l2?: number;
  /** Relative update size below which training stops early. */
  tolerance?: number;
  /**
   * `'balanced'` scales each training row inversely to its class frequency.
   * Effectively mandatory for the AI4I failure modes: with 19 RNF samples among
   * 10,000 rows an unweighted fit can reduce its loss by predicting "no failure"
   * every time. Balanced weighting forces the model to weigh the minority class
   * by its true importance instead of its raw count.
   */
  classWeight?: 'balanced';
}

function sigmoid(value: number): number {
  // Numerically stable for both large positive and large negative inputs.
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

export function fitLogisticRegression(X: number[][], y: string[], options: FitOptions = {}): LogisticRegressionModel {
  const samples = X.length;
  if (samples === 0) throw new Error('Cannot fit a model on an empty training set.');
  if (samples !== y.length) throw new Error(`X has ${samples} rows but y has ${y.length} labels.`);

  const features = X[0].length;
  if (features === 0) throw new Error('Cannot fit a model with zero features.');
  for (const row of X) {
    if (row.length !== features) throw new Error('All feature rows must have the same length.');
    for (const value of row) {
      if (!Number.isFinite(value)) throw new Error('Feature matrix contains a non-finite value.');
    }
  }

  const epochs = options.epochs ?? 250;
  const learningRate = options.learningRate ?? 0.5;
  const l2 = options.l2 ?? 0.01;
  const tolerance = options.tolerance ?? 1e-6;

  const labels = [...new Set(y)].sort();

  // Per-row sample weights. With classWeight='balanced' each row is weighted by
  // n / (k * n_class), so a rare positive contributes as much as its rarity
  // deserves instead of being drowned out by the 96% majority.
  const sampleWeights = new Array<number>(samples).fill(1);
  let weightSum = samples;
  if (options.classWeight === 'balanced') {
    const counts = new Map<string, number>();
    for (const label of y) counts.set(label, (counts.get(label) || 0) + 1);
    const classCount = Math.max(1, labels.length);
    for (let i = 0; i < samples; i += 1) {
      const frequency = counts.get(y[i]) || 1;
      sampleWeights[i] = samples / (classCount * frequency);
    }
    weightSum = sampleWeights.reduce((sum, value) => sum + value, 0) || samples;
  }

  // Standardise from the training split so no feature dominates purely because
  // it is measured on a larger scale (rpm ~1500 vs tool wear ~100).
  const featureMean = new Array<number>(features).fill(0);
  for (const row of X) for (let j = 0; j < features; j += 1) featureMean[j] += row[j];
  for (let j = 0; j < features; j += 1) featureMean[j] /= samples;

  const variance = new Array<number>(features).fill(0);
  for (const row of X) for (let j = 0; j < features; j += 1) variance[j] += (row[j] - featureMean[j]) ** 2;

  const featureStd = variance.map((value) => {
    const deviation = Math.sqrt(value / samples);
    // A constant feature would divide by zero; neutralise it instead.
    return deviation > 1e-9 ? deviation : 1;
  });

  const standardised = X.map((row) => row.map((value, j) => (value - featureMean[j]) / featureStd[j]));

  const weights: number[][] = [];
  const bias: number[] = [];
  let stoppedAtEpoch = epochs;

  for (const label of labels) {
    const target = y.map((value) => (value === label ? 1 : 0));
    const w = new Array<number>(features).fill(0);
    let b = 0;

    for (let epoch = 0; epoch < epochs; epoch += 1) {
      const gradW = new Array<number>(features).fill(0);
      let gradB = 0;

      for (let i = 0; i < samples; i += 1) {
        const row = standardised[i];
        const rowWeight = sampleWeights[i];
        let score = b;
        for (let j = 0; j < features; j += 1) score += w[j] * row[j];
        const error = rowWeight * (sigmoid(score) - target[i]);
        for (let j = 0; j < features; j += 1) gradW[j] += error * row[j];
        gradB += error;
      }

      let maxUpdate = 0;
      for (let j = 0; j < features; j += 1) {
        const update = learningRate * (gradW[j] / weightSum + l2 * w[j]);
        w[j] -= update;
        maxUpdate = Math.max(maxUpdate, Math.abs(update));
      }
      const biasUpdate = learningRate * (gradB / weightSum);
      b -= biasUpdate;
      maxUpdate = Math.max(maxUpdate, Math.abs(biasUpdate));

      if (maxUpdate < tolerance) {
        stoppedAtEpoch = epoch + 1;
        break;
      }
    }

    weights.push(w);
    bias.push(b);
  }

  return {
    kind: 'logistic-regression',
    labels,
    featureNames: [],
    featureMean,
    featureStd,
    weights,
    bias,
    training: {
      samples,
      features,
      classes: labels.length,
      epochs,
      learningRate,
      l2,
      stoppedAtEpoch
    }
  };
}

export interface Prediction {
  label: string;
  /** Probability in [0, 1], normalised across classes to sum to 1. */
  probability: number;
}

/** Raw one-vs-rest scores for a single row, before normalisation. */
function rawScores(model: LogisticRegressionModel, x: number[]): number[] {
  return model.weights.map((weights, classIndex) => {
    let score = model.bias[classIndex];
    const length = Math.min(weights.length, x.length);
    for (let j = 0; j < length; j += 1) {
      score += weights[j] * ((x[j] - model.featureMean[j]) / model.featureStd[j]);
    }
    return sigmoid(score);
  });
}

export function predictProbabilities(model: LogisticRegressionModel, x: number[]): Prediction[] {
  const scores = rawScores(model, x);
  const total = scores.reduce((sum, value) => sum + value, 0);
  return model.labels
    .map((label, index) => ({
      label,
      probability: total === 0 ? 0 : scores[index] / total
    }))
    .sort((a, b) => b.probability - a.probability);
}

export function predict(model: LogisticRegressionModel, x: number[]): string {
  return predictProbabilities(model, x)[0].label;
}

export function predictMany(model: LogisticRegressionModel, rows: number[][]): string[] {
  return rows.map((row) => predict(model, row));
}
