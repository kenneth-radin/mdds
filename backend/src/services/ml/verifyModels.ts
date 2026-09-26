/**
 * Verification gate for trained models — `npm run verify:ml`.
 *
 * Purpose: prove that what the API serves is real, not a stale or half-written
 * artifact. It fails loudly (non-zero exit) if any model card is missing,
 * untrained, unlicensed, unsourced, or if the loaded weights cannot actually
 * produce a prediction on a real row of the dataset.
 *
 * This is the check that keeps "we trained a model" from silently degrading
 * into "we trained a model once and then deleted the file".
 */
import { FEATURE_NAMES, FAILURE_MODES, ai4iCsvPath, loadAi4iRows } from './ai4i';
import { getModel, hydrateFromDisk, listCards } from './modelRegistry';
import { predictProbabilities } from './logisticRegression';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  checks.push({ name, ok, detail });
}

function run(): void {
  const loaded = hydrateFromDisk();
  const cards = listCards();
  const expected = ['ai4i-machine-failure', ...FAILURE_MODES.map((mode) => `ai4i-${mode.toLowerCase()}`)];

  check('models hydrated from disk', loaded > 0, `loaded=${loaded}`);
  check('all six model cards present', cards.length === expected.length, `found=${cards.length}`);

  for (const id of expected) {
    const card = cards.find((entry) => entry.id === id);
    if (!card) {
      check(`card exists: ${id}`, false, 'missing');
      continue;
    }
    check(`trained: ${id}`, card.status === 'trained', card.status);
    check(`dataset licensed: ${id}`, card.dataset?.license === 'CC BY 4.0', card.dataset?.license ?? 'none');
    check(`dataset flagged synthetic: ${id}`, card.dataset?.synthetic === true, String(card.dataset?.synthetic));
    check(`citation present: ${id}`, Boolean(card.dataset?.citation && card.dataset.citation.includes('doi.org')));
    check(`features declared: ${id}`, card.features.length === FEATURE_NAMES.length, `${card.features.length}`);
    check(`limitations disclosed: ${id}`, card.limitations.length >= 5, `${card.limitations.length}`);
    check(
      `cross-validated: ${id}`,
      card.evaluation !== null && card.evaluation.folds === 5 && card.evaluation.samples === 10000,
      card.evaluation ? `${card.evaluation.method} n=${card.evaluation.samples}` : 'none'
    );
    check(
      `baseline reported: ${id}`,
      card.evaluation !== null && card.evaluation.majorityClassBaseline > 0,
      card.evaluation ? `${(card.evaluation.majorityClassBaseline * 100).toFixed(2)}%` : 'none'
    );
    check(`weights loaded: ${id}`, getModel(id) !== undefined);
  }

  // The weights must work on unseen real rows, not just exist on disk.
  try {
    const rows = loadAi4iRows();
    const card = cards.find((entry) => entry.id === 'ai4i-machine-failure');
    const model = getModel('ai4i-machine-failure');
    if (model && card) {
      const probabilities = predictProbabilities(model, rows[0].features);
      const top = probabilities[0];
      check(
        'inference produces a valid probability',
        top !== undefined && Number.isFinite(top.probability) && top.probability >= 0 && top.probability <= 1,
        top ? `${top.label}=${(top.probability * 100).toFixed(2)}%` : 'no output'
      );
      check('dataset still loadable', rows.length === 10000, `rows=${rows.length}`);
    } else {
      check('inference produces a valid probability', false, 'model not registered');
    }
  } catch (error) {
    check('inference produces a valid probability', false, (error as Error).message);
  }

  const failed = checks.filter((entry) => !entry.ok);
  for (const entry of checks) {
    console.log(`${entry.ok ? 'PASS' : 'FAIL'} - ${entry.name}${entry.detail ? ` :: ${entry.detail}` : ''}`);
  }
  console.log('');
  console.log(`dataset : ${ai4iCsvPath()}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

try {
  run();
} catch (error) {
  console.error('ML VERIFY ERROR:', error instanceof Error ? error.message : error);
  process.exit(1);
}
