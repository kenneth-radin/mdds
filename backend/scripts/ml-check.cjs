/* Live verification of the ML endpoints.
   Run against a started backend:  node scripts/ml-check.cjs
   Override the target with ML_BASE (default http://127.0.0.1:4010). */
const BASE = process.env.ML_BASE || 'http://127.0.0.1:4010';
const results = [];
let token = '';

function check(name, condition, extra) {
  results.push({ name, ok: !!condition, extra });
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.auth === false || !token ? {} : { Authorization: `Bearer ${token}` })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, payload };
}

const BENIGN = {
  airTemperatureK: 298.1,
  processTemperatureK: 308.6,
  rotationalSpeedRpm: 1551,
  torqueNm: 42.8,
  toolWearMin: 0,
  productType: 'L'
};

// High tool wear + high torque: the documented TWF / OSF pressure region.
const STRESSED = {
  airTemperatureK: 298.1,
  processTemperatureK: 308.6,
  rotationalSpeedRpm: 1300,
  torqueNm: 68,
  toolWearMin: 240,
  productType: 'L'
};

async function main() {
  const health = await call('/api/health', { auth: false });
  check(
    'health reports the trained models',
    health.status === 200 && health.payload.models === 6,
    `models=${health.payload && health.payload.models}`
  );

  const stamp = Date.now();
  const register = await call('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: { name: 'ML Checker', email: `mlcheck${stamp}@test.local`, username: `mlcheck${stamp}`, password: 'mlcheck123', title: 'Tester' }
  });
  check('register/login for the smoke run', register.status === 201 && !!register.payload.token, `status=${register.status}`);
  token = register.payload.token;

  const anonymous = await call('/api/ml/models', { auth: false });
  check('ml endpoints require authentication', anonymous.status === 401, `status=${anonymous.status}`);

  const list = await call('/api/ml/models');
  const cards = (list.payload && list.payload.models) || [];
  check('six model cards served', list.status === 200 && cards.length === 6, `count=${cards.length}`);
  check('every card is trained', cards.every((card) => card.status === 'trained'), cards.map((c) => c.status).join(','));
  check(
    'every card declares the real dataset licence',
    cards.every((card) => card.dataset && card.dataset.license === 'CC BY 4.0' && card.dataset.citation),
    'CC BY 4.0'
  );
  check(
    'every card is flagged as synthetic, non-facility data',
    cards.every((card) => card.dataset && card.dataset.synthetic === true),
    'synthetic=true'
  );
  check(
    'every card reports a majority-class baseline',
    cards.every((card) => card.evaluation && card.evaluation.majorityClassBaseline > 0),
    cards.map((c) => `${c.id}:${(c.evaluation.majorityClassBaseline * 100).toFixed(2)}%`).join(' ')
  );
  check(
    'every card reports a confusion matrix',
    cards.every((card) => card.evaluation && Array.isArray(card.evaluation.confusionMatrix) && card.evaluation.confusionMatrix.length === 2)
  );
  check(
    'every card discloses limitations',
    cards.every((card) => Array.isArray(card.limitations) && card.limitations.length >= 5),
    `min=${Math.min(...cards.map((c) => c.limitations.length))}`
  );

  const one = await call('/api/ml/models/ai4i-machine-failure');
  check(
    'single card lookup returns cross-validation detail',
    one.status === 200 && /cross-validation/i.test(one.payload.model.evaluation.method),
    one.payload.model && one.payload.model.evaluation.method
  );

  const missing = await call('/api/ml/models/not-a-real-model');
  check('unknown model id is a 404, not a silent empty result', missing.status === 404, `status=${missing.status}`);

  const benign = await call('/api/ml/predict', { method: 'POST', body: BENIGN });
  check('predict returns every classifier', benign.status === 200 && benign.payload.results.length === 6);
  check('predict exposes the derived feature vector', benign.payload.features.length === 11, `n=${benign.payload.features.length}`);
  check(
    'all probabilities are in [0,1]',
    benign.payload.results.every((r) => r.probability >= 0 && r.probability <= 1)
  );
  check(
    'predict returns model limitations alongside the numbers',
    Array.isArray(benign.payload.limitations) && benign.payload.limitations.length >= 5
  );

  const stressed = await call('/api/ml/predict', { method: 'POST', body: STRESSED });
  const riskOf = (payload, id) => (payload.results.find((r) => r.modelId === id) || {}).probability;
  const benignRisk = riskOf(benign.payload, 'ai4i-machine-failure');
  const stressedRisk = riskOf(stressed.payload, 'ai4i-machine-failure');

  check(
    'model responds to inputs instead of returning a constant',
    benignRisk !== stressedRisk,
    `benign=${benignRisk} stressed=${stressedRisk}`
  );
  check(
    'high tool-wear/high-torque input raises predicted failure risk',
    stressedRisk > benignRisk,
    `${benignRisk} -> ${stressedRisk}`
  );

  const badBody = await call('/api/ml/predict', { method: 'POST', body: { ...BENIGN, torqueNm: 'lots' } });
  check('malformed operating parameters are rejected', badBody.status === 422, `status=${badBody.status}`);

  const badType = await call('/api/ml/predict', { method: 'POST', body: { ...BENIGN, productType: 'X' } });
  check('unknown product type is rejected', badType.status === 422, `status=${badType.status}`);

  const failed = results.filter((entry) => !entry.ok);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} ML checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ML CHECK ERROR:', error.message);
  process.exit(1);
});

