/**
 * ML endpoints (Layer 3).
 *
 * GET  /api/ml/models        -> every model card (dataset, licence, metrics, limitations)
 * GET  /api/ml/models/:id    -> one card
 * POST /api/ml/predict       -> run the benchmark classifiers on entered parameters
 *
 * The predict response always carries the model card's evaluation summary and
 * its limitations, so a caller cannot receive a bare probability with no context
 * about what produced it or how well it was measured (§23).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { FAILURE_MODES, FEATURE_NAMES, OperatingParameters, buildFeatureVector } from '../services/ml/ai4i';
import { getCard, getModel, listCards } from '../services/ml/modelRegistry';
import { predictProbabilities } from '../services/ml/logisticRegression';

const router = Router();
router.use(requireAuth);

const predictSchema = z.object({
  airTemperatureK: z.number().min(0).max(500),
  processTemperatureK: z.number().min(0).max(500),
  rotationalSpeedRpm: z.number().min(0).max(100000),
  torqueNm: z.number().min(0).max(10000),
  toolWearMin: z.number().min(0).max(100000),
  productType: z.enum(['L', 'M', 'H'])
});

/** 0.5 is the decision threshold; it is returned so the client never has to assume one. */
const DECISION_THRESHOLD = 0.5;

router.get(
  '/ml/models',
  asyncHandler(async (_req, res) => {
    res.json({
      models: listCards(),
      count: listCards().length,
      decisionThreshold: DECISION_THRESHOLD
    });
  })
);

router.get(
  '/ml/models/:id',
  asyncHandler(async (req, res) => {
    const card = getCard(String(req.params.id));
    if (!card) throw new HttpError(404, `No model with id "${req.params.id}".`);
    res.json({ model: card, decisionThreshold: DECISION_THRESHOLD });
  })
);

router.post(
  '/ml/predict',
  validateBody(predictSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof predictSchema>;
    const features = buildFeatureVector(input as OperatingParameters);

    const results = listCards().map((card) => {
      const model = getModel(card.id);
      if (!model) {
        return {
          modelId: card.id,
          name: card.name,
          status: 'not-trained' as const,
          reason: card.reason ?? 'Model weights are not loaded.'
        };
      }
      const probabilities = predictProbabilities(model, features);
      const positive = probabilities.find((entry) => entry.label === '1');
      const probability = positive ? Math.round(positive.probability * 10000) / 10000 : 0;
      return {
        modelId: card.id,
        name: card.name,
        status: 'trained' as const,
        flagged: probability >= DECISION_THRESHOLD,
        probability,
        decisionThreshold: DECISION_THRESHOLD,
        evaluation: card.evaluation
          ? {
              method: card.evaluation.method,
              accuracy: card.evaluation.accuracy,
              majorityClassBaseline: card.evaluation.majorityClassBaseline,
              macroF1: card.evaluation.macroF1,
              perClass: card.evaluation.perClass
            }
          : null
      };
    });

    res.json({
      analysisMethod: 'ai4i-logistic-regression',
      layer: 3,
      input,
      features: FEATURE_NAMES.map((name, index) => ({ name, value: features[index] })),
      results,
      limitations:
        getCard('ai4i-machine-failure')?.limitations ??
        [],
      note:
        'Predictions are produced by models trained on the synthetic AI4I 2020 benchmark, not on this ' +
        'facility\'s equipment. They demonstrate the trained pipeline and must not be reported as ' +
        'live sensor monitoring.'
    });
  })
);

export { FAILURE_MODES };
export default router;
