/**
 * Evaluation metrics.
 *
 * Why this module exists: the AI4I benchmark is severely imbalanced
 * (339 failures out of 10,000 rows). A model that predicts "no failure" for
 * every single row would score 96.61% accuracy while being completely useless.
 * Accuracy alone is therefore a misleading headline number, so every model in
 * this system reports precision, recall, F1 and the confusion matrix alongside
 * it - and states the majority-class baseline for comparison.
 *
 * Zero dependencies, deterministic.
 */
import { round } from '../../utils/helpers';

export interface PerClassMetrics {
  label: string;
  /** Number of ground-truth occurrences of this label. */
  support: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ClassificationReport {
  labels: string[];
  /** confusionMatrix[i][j] = samples whose true label is labels[i] and predicted labels[j]. */
  confusionMatrix: number[][];
  perClass: PerClassMetrics[];
  accuracy: number;
  macroF1: number;
  weightedF1: number;
  samples: number;
  /** Accuracy of always predicting the most common label — the number to beat. */
  majorityClassBaseline: number;
  majorityClassLabel: string;
}

function labelsOf(...collections: string[][]): string[] {
  const set = new Set<string>();
  for (const collection of collections) for (const label of collection) set.add(label);
  return [...set].sort();
}

export function confusionMatrix(yTrue: string[], yPred: string[], labels: string[]): number[][] {
  if (yTrue.length !== yPred.length) {
    throw new Error(`yTrue (${yTrue.length}) and yPred (${yPred.length}) must be the same length.`);
  }
  const index = new Map(labels.map((label, i) => [label, i]));
  const matrix = labels.map(() => new Array<number>(labels.length).fill(0));
  for (let i = 0; i < yTrue.length; i += 1) {
    const trueIndex = index.get(yTrue[i]);
    const predIndex = index.get(yPred[i]);
    if (trueIndex === undefined || predIndex === undefined) {
      throw new Error(`Label not in label set: ${trueIndex === undefined ? yTrue[i] : yPred[i]}`);
    }
    matrix[trueIndex][predIndex] += 1;
  }
  return matrix;
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator, 4);
}

export function classificationReport(yTrue: string[], yPred: string[], labels?: string[]): ClassificationReport {
  const labelSet = labels ?? labelsOf(yTrue, yPred);
  const matrix = confusionMatrix(yTrue, yPred, labelSet);

  const perClass: PerClassMetrics[] = labelSet.map((label, i) => {
    const support = matrix[i].reduce((sum, value) => sum + value, 0);
    const truePositives = matrix[i][i];
    let falsePositives = 0;
    for (let row = 0; row < labelSet.length; row += 1) falsePositives += matrix[row][i];
    falsePositives -= truePositives;
    const falseNegatives = support - truePositives;

    const precision = divide(truePositives, truePositives + falsePositives);
    const recall = divide(truePositives, support);
    const f1 = precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall), 4);

    return { label, support, truePositives, falsePositives, falseNegatives, precision, recall, f1 };
  });

  const samples = yTrue.length;
  let correct = 0;
  for (let i = 0; i < labelSet.length; i += 1) correct += matrix[i][i];

  const supportTotal = perClass.reduce((sum, entry) => sum + entry.support, 0);
  const macroF1 =
    perClass.length === 0 ? 0 : round(perClass.reduce((sum, entry) => sum + entry.f1, 0) / perClass.length, 4);
  const weightedF1 =
    supportTotal === 0
      ? 0
      : round(perClass.reduce((sum, entry) => sum + entry.f1 * entry.support, 0) / supportTotal, 4);

  const counts = new Map<string, number>();
  for (const label of yTrue) counts.set(label, (counts.get(label) || 0) + 1);
  let majorityClassLabel = '';
  let majorityCount = 0;
  counts.forEach((count, label) => {
    if (count > majorityCount) {
      majorityCount = count;
      majorityClassLabel = label;
    }
  });

  return {
    labels: labelSet,
    confusionMatrix: matrix,
    perClass,
    accuracy: divide(correct, samples),
    macroF1,
    weightedF1,
    samples,
    majorityClassBaseline: divide(majorityCount, samples),
    majorityClassLabel
  };
}

/** Deterministic PRNG so cross-validation folds are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stratified k-fold: every fold keeps roughly the same class proportions.
 * Stratification is essential here — with a random split, the 19 RNF samples
 * would frequently all land in one fold and the model could never learn them.
 */
export function stratifiedKFold(y: string[], k: number, seed = 42): Array<{ train: number[]; test: number[] }> {
  if (k < 2) throw new Error('k must be at least 2.');
  const random = mulberry32(seed);
  const buckets = new Map<string, number[]>();
  y.forEach((label, index) => {
    const bucket = buckets.get(label);
    if (bucket) bucket.push(index);
    else buckets.set(label, [index]);
  });

  const folds: number[][] = Array.from({ length: k }, () => []);
  buckets.forEach((indices) => {
    const shuffled = [...indices];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((index, position) => folds[position % k].push(index));
  });

  return folds.map((test, foldIndex) => ({
    test,
    train: folds.filter((_, i) => i !== foldIndex).flat()
  }));
}
