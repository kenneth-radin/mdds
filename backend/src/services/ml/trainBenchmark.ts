/**
 * Layer 3 — trains and evaluates the benchmark failure-mode classifier.
 *
 * Run with:  npm run train:ml
 *
 * Procedure (nothing here is skipped or faked):
 *   1. Load the AI4I 2020 CSV (10,000 rows, 5 independent failure modes).
 *   2. For each target, run 5-fold STRATIFIED cross-validation. Every recorded
 *      prediction comes from a model that never saw that row while training.
 *   3. Report precision / recall / F1 / confusion matrix against the
 *      majority-class baseline — never accuracy alone, because a model that
 *      always predicts "no failure" already scores 96.61% on this data.
 *   4. Refit on the full dataset and register the model together with its card.
 *
 * If the data is missing or malformed this throws, rather than quietly
 * producing an untrained model that still carries plausible-looking numbers.
 */
import { FAILURE_MODES, FAILURE_MODE_MEANINGS, FEATURE_NAMES, ai4iCsvPath, loadAi4iRows } from './ai4i';
import { fitLogisticRegression, predict } from './logisticRegression';
import { classificationReport, stratifiedKFold, ClassificationReport } from './metrics';
import { DatasetDescriptor, ModelCard, evaluationFromReport, registerModel } from './modelRegistry';

const CV_FOLDS = 5;
const CV_SEED = 42;
const EPOCHS = 150;
const LEARNING_RATE = 0.5;
const L2 = 0.01;

function ai4iDatasetDescriptor(classBalance: Record<string, number>, samples: number): DatasetDescriptor {
  return {
    name: 'AI4I 2020 Predictive Maintenance Dataset',
    source: 'UCI Machine Learning Repository, dataset id 601',
    citation:
      'AI4I 2020 Predictive Maintenance Dataset [Dataset]. (2020). UCI ML Repository. https://doi.org/10.24432/C5HS5C',
    license: 'CC BY 4.0',
    synthetic: true,
    samples,
    classBalance,
    note:
      'Synthetic data that reflects real predictive maintenance scenarios. It is NOT measured at this ' +
      'institution and is never written into the plant database.'
  };
}

const COMMON_LIMITATIONS = [
  'The dataset is synthetic — UCI states it "reflects" industry data. It is not measured from this facility.',
  'The failure-mode labels are documented deterministic functions of the input features, so this model ' +
    'demonstrates that the training pipeline learns those relationships. It is not evidence of predictive ' +
    'skill on real plant equipment.',
  'Accuracy sits BELOW the majority-class baseline on purpose: balanced class weighting trades ' +
    'specificity for recall so that rare failures are not simply ignored. A model that always answered ' +
    '"no failure" would score 96.61% accuracy and catch nothing. Read precision, recall and the ' +
    'confusion matrix — not accuracy alone.',
  'High recall comes at the price of false alarms: the classifier is a screening tool that flags ' +
    'candidates for inspection, not a confirmatory test.',
  'Features include three physics-informed derivations (temperature gap, mechanical power, wear x strain) ' +
    'taken from the dataset documentation, not fitted from the labels.',
  'RNF (random failure) is defined as independent of operating parameters; its near-zero measured ' +
    'precision is the expected outcome, not a bug.',
  'Oriented toward rotating machinery (tool wear, torque, speed); transfer to other equipment is untested.',
  'Decision support only — maintenance personnel make the final call (§24).'
];

/** 5-fold stratified cross-validation, returning one pooled out-of-fold report. */
function crossValidate(X: number[][], y: string[]): ClassificationReport {
  const folds = stratifiedKFold(y, CV_FOLDS, CV_SEED);
  const yTrue = new Array<string>(y.length);
  const yPred = new Array<string>(y.length);

  for (const fold of folds) {
    const model = fitLogisticRegression(
      fold.train.map((index) => X[index]),
      fold.train.map((index) => y[index]),
      { epochs: EPOCHS, learningRate: LEARNING_RATE, l2: L2, classWeight: 'balanced' }
    );
    for (const index of fold.test) {
      yTrue[index] = y[index];
      yPred[index] = predict(model, X[index]);
    }
  }

  return classificationReport(yTrue, yPred, ['0', '1']);
}

export interface TrainingOutcome {
  cards: ModelCard[];
  reports: Array<{ id: string; mode: string; report: ClassificationReport }>;
  elapsedMs: number;
}

export function trainBenchmarkModels(): TrainingOutcome {
  const startedAt = Date.now();
  const rows = loadAi4iRows();
  const X = rows.map((row) => row.features);

  const targets: Array<{ id: string; mode: string; y: string[] }> = [
    {
      id: 'ai4i-machine-failure',
      mode: 'Machine failure (any)',
      y: rows.map((row) => (row.failed ? '1' : '0'))
    },
    ...FAILURE_MODES.map((mode) => ({
      id: `ai4i-${mode.toLowerCase()}`,
      mode: `${mode} — ${FAILURE_MODE_MEANINGS[mode]}`,
      y: rows.map((row) => (row.targets[FAILURE_MODES.indexOf(mode)] === 1 ? '1' : '0'))
    }))
  ];

  const cards: ModelCard[] = [];
  const reports: Array<{ id: string; mode: string; report: ClassificationReport }> = [];

  for (const target of targets) {
    const positives = target.y.filter((value) => value === '1').length;
    const report = crossValidate(X, target.y);

    const model = fitLogisticRegression(X, target.y, {
      epochs: EPOCHS,
      learningRate: LEARNING_RATE,
      l2: L2,
      classWeight: 'balanced'
    });
    model.featureNames = [...FEATURE_NAMES];

    const card: ModelCard = {
      id: target.id,
      name: target.mode,
      description:
        'One-vs-rest logistic regression over AI4I operating parameters, fitted with balanced class ' +
        'weights and evaluated by 5-fold stratified cross-validation.',
      kind: 'logistic-regression',
      layer: 3,
      status: 'trained',
      task: 'binary classification',
      dataset: ai4iDatasetDescriptor({ positive: positives, negative: target.y.length - positives }, rows.length),
      features: [...FEATURE_NAMES],
      labels: ['0', '1'],
      training: model.training,
      evaluation: evaluationFromReport(report, `${CV_FOLDS}-fold stratified cross-validation`, CV_FOLDS, CV_SEED),
      limitations: COMMON_LIMITATIONS,
      trainedAt: new Date().toISOString()
    };

    registerModel(card, model);
    cards.push(card);
    reports.push({ id: target.id, mode: target.mode, report });
  }

  return { cards, reports, elapsedMs: Date.now() - startedAt };
}

/**
 * CLI entry point — `npm run train:ml`.
 *
 * Keeps training out of the request path: models are fitted once, persisted to
 * backend/data/models/, and loaded at server start.
 */
function main(): void {
  // eslint-disable-next-line no-console
  console.log('[ml] training AI4I benchmark models…');
  const outcome = trainBenchmarkModels();
  // eslint-disable-next-line no-console
  console.log(formatTrainingReport(outcome, ai4iCsvPath()));
  // eslint-disable-next-line no-console
  console.log(
    `[ml] registered ${outcome.cards.length} model cards: ${outcome.cards.map((card) => card.id).join(', ')}`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[ml] training failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** Human-readable training summary for the console / CI log. */
export function formatTrainingReport(outcome: TrainingOutcome, csvPath: string): string {
  const lines: string[] = ['', `dataset        : ${csvPath}`];
  lines.push(`models trained : ${outcome.cards.length}`);
  lines.push(`elapsed        : ${(outcome.elapsedMs / 1000).toFixed(1)}s`, '');

  for (const entry of outcome.reports) {
    const r = entry.report;
    lines.push(`--- ${entry.id}  (${entry.mode}) ---`);
    lines.push(
      `  accuracy ${pct(r.accuracy)} | majority-class baseline ${pct(r.majorityClassBaseline)} (always "${r.majorityClassLabel}")`
    );
    lines.push(`  macro-F1 ${pct(r.macroF1)} | weighted-F1 ${pct(r.weightedF1)} | samples ${r.samples}`);
    for (const cls of r.perClass) {
      lines.push(
        `    label ${cls.label}: support=${String(cls.support).padStart(5)}  ` +
          `precision=${pct(cls.precision)}  recall=${pct(cls.recall)}  f1=${pct(cls.f1)}`
      );
    }
    lines.push('    confusion matrix (rows=true, cols=pred, labels 0,1):');
    for (const row of r.confusionMatrix) {
      lines.push(`      [ ${row.map((value) => String(value).padStart(6)).join(' ')} ]`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
