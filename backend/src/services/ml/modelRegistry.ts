/**
 * Model registry — persistence and the "model card".
 *
 * A model card is the part that makes the AI defensible at a capstone defence:
 * for every model the system exposes, it states the dataset and its licence,
 * whether the data is synthetic, the exact features given, how evaluation was
 * performed, the full per-class metrics, the majority-class baseline it had to
 * beat, and an explicit list of limitations.
 *
 * A card with `status: 'not-trained'` is a first-class result, not an error —
 * it is how the system says "I do not have enough evidence yet" instead of
 * inventing an answer (§20, §21).
 */
import * as fs from 'fs';
import * as path from 'path';
import { ClassificationReport, PerClassMetrics } from './metrics';
import { LogisticRegressionModel } from './logisticRegression';

export interface DatasetDescriptor {
  name: string;
  source: string;
  citation: string;
  license: string;
  synthetic: boolean;
  samples: number;
  /** Exact label counts measured from the file, not assumed. */
  classBalance: Record<string, number>;
  note: string;
}

export interface EvaluationDescriptor {
  method: string;
  folds: number;
  seed: number;
  accuracy: number;
  macroF1: number;
  weightedF1: number;
  majorityClassBaseline: number;
  majorityClassLabel: string;
  samples: number;
  labels: string[];
  perClass: PerClassMetrics[];
  confusionMatrix: number[][];
}

export interface ModelCard {
  id: string;
  name: string;
  description: string;
  kind: 'logistic-regression';
  layer: 1 | 2 | 3;
  status: 'trained' | 'not-trained';
  /** Why the model is unavailable (only set when status is 'not-trained'). */
  reason?: string;
  task: string;
  dataset: DatasetDescriptor | null;
  features: string[];
  labels: string[];
  training: LogisticRegressionModel['training'] | null;
  evaluation: EvaluationDescriptor | null;
  limitations: string[];
  trainedAt: string | null;
}

interface RegistryEntry {
  card: ModelCard;
  model: LogisticRegressionModel | null;
}

const registry = new Map<string, RegistryEntry>();

function modelsDir(): string {
  return path.resolve(__dirname, '../../../data/models');
}

function manifestPath(): string {
  return path.join(modelsDir(), 'manifest.json');
}

function modelPath(id: string): string {
  return path.join(modelsDir(), `${id}.json`);
}

function persist(card: ModelCard, model: LogisticRegressionModel | null): void {
  try {
    fs.mkdirSync(modelsDir(), { recursive: true });
    if (model) fs.writeFileSync(modelPath(card.id), JSON.stringify(model));
    const manifest = [...registry.values()].map((entry) => entry.card);
    fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2));
  } catch (error) {
    // Losing persistence must never take the API down; the in-memory copy still serves.
    console.error('[ml] could not persist model registry:', (error as Error).message);
  }
}

export function registerModel(card: ModelCard, model: LogisticRegressionModel | null): void {
  registry.set(card.id, { card, model });
  persist(card, model);
}

/** Loads a previously persisted model back into memory, if present. */
export function hydrateFromDisk(): number {
  try {
    if (!fs.existsSync(manifestPath())) return 0;
    const cards: ModelCard[] = JSON.parse(fs.readFileSync(manifestPath(), 'utf8'));
    let loaded = 0;
    for (const card of cards) {
      let model: LogisticRegressionModel | null = null;
      if (card.status === 'trained' && fs.existsSync(modelPath(card.id))) {
        model = JSON.parse(fs.readFileSync(modelPath(card.id), 'utf8'));
      }
      registry.set(card.id, { card, model });
      loaded += 1;
    }
    return loaded;
  } catch (error) {
    console.error('[ml] could not hydrate model registry:', (error as Error).message);
    return 0;
  }
}

export function listCards(): ModelCard[] {
  return [...registry.values()].map((entry) => entry.card);
}

export function getCard(id: string): ModelCard | undefined {
  return registry.get(id)?.card;
}

export function getModel(id: string): LogisticRegressionModel | undefined {
  const entry = registry.get(id);
  if (!entry || !entry.model) return undefined;
  return entry.model;
}

export function hasModel(id: string): boolean {
  const entry = registry.get(id);
  return Boolean(entry && entry.model);
}

/** Builds an evaluation descriptor from a cross-validation report. */
export function evaluationFromReport(report: ClassificationReport, method: string, folds: number, seed: number): EvaluationDescriptor {
  return {
    method,
    folds,
    seed,
    accuracy: report.accuracy,
    macroF1: report.macroF1,
    weightedF1: report.weightedF1,
    majorityClassBaseline: report.majorityClassBaseline,
    majorityClassLabel: report.majorityClassLabel,
    samples: report.samples,
    labels: report.labels,
    perClass: report.perClass,
    confusionMatrix: report.confusionMatrix
  };
}
