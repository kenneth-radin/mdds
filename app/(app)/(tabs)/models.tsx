import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Chip,
  ChoiceGroup,
  Collapse,
  EmptyState,
  Field,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatCard,
  theme
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { MlModelCard, MlModelList, MlOperatingParameters, MlPredictResponse } from '../../../lib/types';
import { fmtDateTime, fmtNumber, isValidNumberInput, toNumberOrNull } from '../../../lib/format';

const pct = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

/** Signed difference in percentage points, so a shortfall reads as a shortfall. */
const points = (delta: number): string => `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)} pts`;

type NumericKey = 'airTemperatureK' | 'processTemperatureK' | 'rotationalSpeedRpm' | 'torqueNm' | 'toolWearMin';

type NumericForm = Record<NumericKey, string>;

const NUMERIC_FIELDS: Array<{ key: NumericKey; label: string; placeholder: string }> = [
  { key: 'airTemperatureK', label: 'Air temperature (K)', placeholder: '298.1' },
  { key: 'processTemperatureK', label: 'Process temperature (K)', placeholder: '308.6' },
  { key: 'rotationalSpeedRpm', label: 'Rotational speed (rpm)', placeholder: '1551' },
  { key: 'torqueNm', label: 'Torque (Nm)', placeholder: '39.8' },
  { key: 'toolWearMin', label: 'Tool wear (min)', placeholder: '108' }
];

/**
 * Two points chosen from the measured AI4I 2020 feature ranges (air 295.3-304.5 K,
 * process 305.7-313.8 K, speed 1168-2886 rpm, torque 3.8-76.6 Nm, wear 0-253 min).
 * The contrasting pair exists so a reviewer can prove the models respond to their
 * input instead of returning a hard-coded answer.
 */
const PRESETS: Array<{ label: string; values: MlOperatingParameters }> = [
  {
    label: 'Typical values',
    values: {
      airTemperatureK: 298.1,
      processTemperatureK: 308.6,
      rotationalSpeedRpm: 1551,
      torqueNm: 39.8,
      toolWearMin: 108,
      productType: 'L'
    }
  },
  {
    label: 'Stressed values',
    values: {
      airTemperatureK: 302.5,
      processTemperatureK: 312.4,
      rotationalSpeedRpm: 1300,
      torqueNm: 68,
      toolWearMin: 245,
      productType: 'H'
    }
  }
];

const PRODUCT_TYPES: Array<MlOperatingParameters['productType']> = ['L', 'M', 'H'];

function toForm(values: MlOperatingParameters): NumericForm {
  return {
    airTemperatureK: String(values.airTemperatureK),
    processTemperatureK: String(values.processTemperatureK),
    rotationalSpeedRpm: String(values.rotationalSpeedRpm),
    torqueNm: String(values.torqueNm),
    toolWearMin: String(values.toolWearMin)
  };
}

function MlModelCardView({ card }: { card: MlModelCard }) {
  const trained = card.status === 'trained';
  const evaluation = card.evaluation;
  const belowBaseline = evaluation ? evaluation.accuracy < evaluation.majorityClassBaseline : false;

  return (
    <Card tone={trained ? 'default' : 'muted'}>
      <View style={st.cardHead}>
        <View style={st.cardHeadText}>
          <Text style={st.cardName}>{card.name}</Text>
          <Muted>
            {card.kind} · {card.task} · layer {card.layer}
          </Muted>
        </View>
        <Badge text={trained ? 'trained' : 'unavailable'} tone={trained ? 'success' : 'warning'} />
      </View>

      <Muted>{card.description}</Muted>

      {!trained ? (
        <View style={{ marginTop: theme.space.md }}>
          <Notice tone="warning" title="Weights are not loaded">
            {card.reason ?? 'Model weights are not loaded.'}
          </Notice>
        </View>
      ) : null}

      {trained && evaluation ? (
        <>
          <View style={st.statRow}>
            <StatCard
              label="Accuracy"
              value={pct(evaluation.accuracy)}
              hint="all held-out rows"
              icon="trophy-outline"
            />
            <StatCard
              label="Macro F1"
              value={pct(evaluation.macroF1)}
              hint="every class weighted equally"
              icon="stats-chart-outline"
            />
            <StatCard
              label="Rows evaluated"
              value={String(evaluation.samples)}
              hint="measured, not estimated"
              icon="albums-outline"
            />
          </View>

          <View style={st.chipRow}>
            <Chip
              label={`Accuracy vs baseline ${points(
                evaluation.accuracy - evaluation.majorityClassBaseline
              )}`}
              icon="git-compare-outline"
              tone="primary"
            />
          </View>

          {belowBaseline ? (
            <View style={{ marginTop: theme.space.md }}>
              <Notice tone="warning" title="Below the baseline on purpose">
                Accuracy sits below the majority-class baseline by design. Balanced class weighting trades specificity
                for recall, because a model that always answered “no failure” would score{' '}
                {pct(evaluation.majorityClassBaseline)} while catching nothing. Read precision, recall and the
                confusion matrix below.
              </Notice>
            </View>
          ) : null}
        </>
      ) : null}

      <Collapse
        title="Dataset, training and per-class metrics"
        subtitle="Provenance, cross-validated scores, confusion matrix and stated limitations"
        badge={<Chip label={`${card.limitations.length} limitations`} icon="alert-outline" />}
      >
        <MlModelCardDetails card={card} />
      </Collapse>
    </Card>
  );
}

/** Everything below the fold: provenance, dataset, features, training, per-class metrics, limitations. */
function MlModelCardDetails({ card }: { card: MlModelCard }) {
  const evaluation = card.evaluation;

  return (
    <>
      <SectionHeader title="Provenance" icon="server-outline" />
      <KeyValue label="Model id" value={card.id} />
      <KeyValue label="Kind" value={card.kind} />
      <KeyValue label="Task" value={card.task} />
      <KeyValue label="Layer" value={String(card.layer)} />
      <KeyValue label="Trained at" value={fmtDateTime(card.trainedAt)} />

      <SectionHeader title="Dataset" icon="cube-outline" />
      {card.dataset ? (
        <>
          <KeyValue label="Name" value={card.dataset.name} />
          <KeyValue label="Source" value={card.dataset.source} />
          <KeyValue label="Licence" value={card.dataset.license} />
          <KeyValue
            label="Synthetic"
            value={card.dataset.synthetic ? 'Yes — not measured here' : 'No'}
          />
          <KeyValue label="Rows" value={String(card.dataset.samples)} />
          <View style={st.chipRow}>
            {Object.entries(card.dataset.classBalance).map(([label, count]) => (
              <Chip key={label} label={`Class ${label}: ${count}`} icon="pricetag-outline" />
            ))}
          </View>
          <View style={{ marginTop: theme.space.sm }}>
            <Muted>{card.dataset.note}</Muted>
            <Muted>Citation: {card.dataset.citation}</Muted>
          </View>
        </>
      ) : (
        <Muted>No dataset information supplied for this model.</Muted>
      )}

      <SectionHeader title="Input features" icon="list-outline" />
      <View style={st.chipRow}>
        {card.features.map((feature) => (
          <Chip key={feature} label={feature} />
        ))}
      </View>

      {card.training ? (
        <>
          <SectionHeader
            title="Training run"
            icon="flask-outline"
            subtitle="Gradient descent on balanced class weights"
          />
          <KeyValue label="Rows used" value={String(card.training.samples)} />
          <KeyValue label="Features" value={String(card.training.features)} />
          <KeyValue label="Classes" value={String(card.training.classes)} />
          <KeyValue
            label="Epochs run"
            value={`${card.training.stoppedAtEpoch} of ${card.training.epochs}`}
          />
          <KeyValue label="Learning rate" value={String(card.training.learningRate)} />
          <KeyValue label="L2 penalty" value={String(card.training.l2)} />
        </>
      ) : null}

      {evaluation ? <MlModelEvaluation evaluation={evaluation} /> : null}

      <SectionHeader title="Known limitations" icon="alert-outline" />
      {card.limitations.map((limitation) => (
        <Text key={limitation} style={st.bullet}>
          • {limitation}
        </Text>
      ))}
    </>
  );
}

type Evaluation = NonNullable<MlModelCard['evaluation']>;

function MlModelEvaluation({ evaluation }: { evaluation: Evaluation }) {
  return (
    <>
      <SectionHeader
        title="Evaluation"
        icon="speedometer-outline"
        subtitle={`${evaluation.method} · ${evaluation.folds} folds · seed ${evaluation.seed}`}
      />
      <View style={st.chipRow}>
        <Chip
          label={`most common label: ${evaluation.majorityClassLabel}`}
          icon="pricetag-outline"
          tone="primary"
        />
      </View>

      <View style={{ marginTop: theme.space.xs }}>
        <KeyValue label="Majority-class baseline" value={pct(evaluation.majorityClassBaseline)} />
        <KeyValue label="Weighted-F1" value={pct(evaluation.weightedF1)} />
      </View>

      {evaluation.perClass.map((row) => (
        <View key={row.label} style={st.classBlock}>
          <View style={st.cardHead}>
            <Text style={st.classTitle}>Class {row.label}</Text>
            <Badge text={`${row.support} rows`} tone="info" size="sm" />
          </View>
          <View style={st.statRow}>
            <StatCard label="Precision" value={pct(row.precision)} hint="how often it was right" />
            <StatCard label="Recall" value={pct(row.recall)} hint="how much it found" />
            <StatCard label="F1" value={pct(row.f1)} hint="balance of both" />
          </View>
          <KeyValue
            label="True / false positives"
            value={`${row.truePositives} / ${row.falsePositives}`}
          />
          <KeyValue label="False negatives" value={String(row.falseNegatives)} />
        </View>
      ))}

      <SectionHeader title="Confusion matrix" icon="grid-outline" subtitle="Rows = actual, columns = predicted" />
      <View style={st.matrix}>
        <View style={st.matrixRow}>
          <Text style={[st.matrixCell, st.matrixLabel]} />
          {evaluation.labels.map((label) => (
            <Text key={label} style={[st.matrixCell, st.matrixHead]}>
              pred {label}
            </Text>
          ))}
        </View>
        {evaluation.confusionMatrix.map((row, index) => (
          <View key={evaluation.labels[index] ?? index} style={st.matrixRow}>
            <Text style={[st.matrixCell, st.matrixLabel]}>actual {evaluation.labels[index] ?? index}</Text>
            {row.map((cell, column) => (
              <Text key={`${index}-${column}`} style={st.matrixCell}>
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </>
  );
}

/**
 * Runs the Layer 3 classifiers on entered parameters. It deliberately prints the
 * derived feature vector and each model's measured accuracy next to its output, so
 * a probability is never shown without the evidence behind it (§23).
 */
function PredictPanel({ decisionThreshold }: { decisionThreshold: number }) {
  const [form, setForm] = useState<NumericForm>(() => toForm(PRESETS[0].values));
  const [productType, setProductType] = useState<MlOperatingParameters['productType']>(PRESETS[0].values.productType);
  const [result, setResult] = useState<MlPredictResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const blankFields = NUMERIC_FIELDS.filter((field) => !form[field.key].trim());
  const badFields = NUMERIC_FIELDS.filter((field) => form[field.key].trim() && !isValidNumberInput(form[field.key]));

  const applyPreset = (values: MlOperatingParameters) => {
    setForm(toForm(values));
    setProductType(values.productType);
    setResult(null);
    setError('');
  };

  const run = async () => {
    setError('');
    setResult(null);
    if (blankFields.length || badFields.length) {
      const parts: string[] = [];
      if (blankFields.length) parts.push(`fill in ${blankFields.map((f) => f.label).join(', ')}`);
      if (badFields.length) parts.push(`enter a number for ${badFields.map((f) => f.label).join(', ')}`);
      setError(`Cannot run the models — ${parts.join(' and ')}.`);
      return;
    }

    const input: MlOperatingParameters = {
      airTemperatureK: toNumberOrNull(form.airTemperatureK) ?? 0,
      processTemperatureK: toNumberOrNull(form.processTemperatureK) ?? 0,
      rotationalSpeedRpm: toNumberOrNull(form.rotationalSpeedRpm) ?? 0,
      torqueNm: toNumberOrNull(form.torqueNm) ?? 0,
      toolWearMin: toNumberOrNull(form.toolWearMin) ?? 0,
      productType
    };

    setBusy(true);
    try {
      setResult(await api.post<MlPredictResponse>('/api/ml/predict', input));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tone="hero">
      <SectionHeader
        title="Try the benchmark models"
        icon="flask-outline"
        subtitle="Score operating parameters with the trained classifiers. Nothing is written to the database."
      />

      <View style={st.presetRow}>
        {PRESETS.map((preset) => (
          <View key={preset.label} style={st.presetItem}>
            <Button
              title={preset.label}
              variant="secondary"
              icon="flash-outline"
              onPress={() => applyPreset(preset.values)}
            />
          </View>
        ))}
      </View>

      {NUMERIC_FIELDS.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          value={form[field.key]}
          onChangeText={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
          placeholder={field.placeholder}
          keyboardType="numeric"
        />
      ))}

      <ChoiceGroup
        label="Product type"
        value={productType}
        options={PRODUCT_TYPES.map((type) => ({
          value: type,
          label: `Variant ${type}`,
          hint: `Benchmark quality variant ${type}`
        }))}
        onChange={(value) => setProductType(value)}
      />

      <Button
        title="Run prediction"
        icon="play-outline"
        loading={busy}
        onPress={run}
      />

      {error ? (
        <View style={{ marginTop: theme.space.md }}>
          <Notice tone="danger" title="Prediction could not run">
            {error}
          </Notice>
        </View>
      ) : null}

      {result ? <PredictResults result={result} decisionThreshold={decisionThreshold} /> : null}
    </Card>
  );
}

function PredictResults({ result, decisionThreshold }: { result: MlPredictResponse; decisionThreshold: number }) {
  const flagged = result.results.filter((entry) => entry.flagged).length;

  return (
    <>
      <SectionHeader
        title="Prediction results"
        icon="analytics-outline"
        subtitle={`${result.analysisMethod} · flagged when the probability reaches ${pct(decisionThreshold)}`}
      />

      <View style={st.statRow}>
        <StatCard label="Models run" value={String(result.results.length)} icon="hardware-chip-outline" />
        <StatCard
          label="Flagged"
          value={String(flagged)}
          hint="above the decision threshold"
          icon="warning-outline"
          tone={flagged ? 'warning' : 'default'}
        />
        <StatCard label="Threshold" value={pct(decisionThreshold)} icon="options-outline" />
      </View>

      {result.results.map((entry) => (
        <Card key={entry.modelId} tone="muted" style={{ marginTop: theme.space.md }}>
          <View style={st.cardHead}>
            <Text style={st.classTitle}>{entry.name}</Text>
            {entry.status === 'trained' ? (
              <Badge text={entry.flagged ? 'flagged' : 'not flagged'} tone={entry.flagged ? 'danger' : 'success'} />
            ) : (
              <Badge text="unavailable" tone="warning" />
            )}
          </View>
          {entry.status === 'trained' && entry.probability !== undefined ? (
            <>
              <View style={st.statRow}>
                <StatCard
                  label="Failure probability"
                  value={pct(entry.probability)}
                  hint={
                    entry.flagged
                      ? 'at or above the decision threshold'
                      : 'below the decision threshold'
                  }
                  tone={entry.flagged ? 'warning' : 'default'}
                />
                <StatCard
                  label="Threshold applied"
                  value={pct(entry.decisionThreshold ?? decisionThreshold)}
                  hint="probability that flags failure"
                />
              </View>
              {entry.evaluation ? (
                <View style={{ marginTop: theme.space.sm }}>
                  <Muted>
                    Measured by {entry.evaluation.method}: accuracy {pct(entry.evaluation.accuracy)} against a{' '}
                    {pct(entry.evaluation.majorityClassBaseline)} baseline, macro-F1{' '}
                    {pct(entry.evaluation.macroF1)}.
                  </Muted>
                </View>
              ) : null}
            </>
          ) : (
            <Muted>{entry.reason ?? 'Model weights are not loaded.'}</Muted>
          )}
        </Card>
      ))}

      <Collapse
        title="Feature vector sent to the models"
        subtitle={`${result.features.length} derived values, scaled exactly as during training`}
      >
        {result.features.map((feature) => (
          <KeyValue key={feature.name} label={feature.name} value={fmtNumber(feature.value, 4)} />
        ))}
      </Collapse>

      <Collapse
        title="Known limitations"
        subtitle={`${result.limitations.length} caveats to keep in mind before acting`}
        badge={<Chip label="read before deciding" icon="alert-outline" />}
      >
        {result.limitations.map((limitation) => (
          <Text key={limitation} style={st.bullet}>
            • {limitation}
          </Text>
        ))}
        <Muted>{result.note}</Muted>
      </Collapse>
    </>
  );
}

export default function ModelsScreen() {
  const [data, setData] = useState<MlModelList | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.get<MlModelList>('/api/ml/models'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const trainedCount = data ? data.models.filter((card) => card.status === 'trained').length : 0;

  return (
    <Screen>
      <ScreenHeader
        title="AI predictions"
        subtitle="Benchmark-trained classifiers that estimate failure modes from operating parameters. Decision support only — maintenance personnel make the final call."
        badge={
          data ? (
            <Badge
              text={`${trainedCount}/${data.count} ready`}
              tone={data.count > 0 && trainedCount === data.count ? 'success' : 'warning'}
            />
          ) : undefined
        }
      />

      {error ? (
        <Notice tone="danger" title="Could not reach the model service">
          {error}
        </Notice>
      ) : null}

      {loading && !data ? (
        <Loading
          label="Loading model cards…"
          caption="Reading the trained weights and their evaluation metrics."
        />
      ) : null}

      {data ? (
        <>
          <Notice tone="warning" title="Benchmark models, not your plant data">
            These models are trained on the AI4I 2020 predictive maintenance benchmark, kept separate from your plant
            records. Use them to understand what the data says, not as a work order.
          </Notice>

          <View style={st.statRow}>
            <StatCard
              label="Models ready"
              value={`${trainedCount} / ${data.count}`}
              hint="Layer 3 classifiers"
              icon="hardware-chip-outline"
              tone="primary"
            />
            <StatCard
              label="Decision threshold"
              value={pct(data.decisionThreshold)}
              hint="probability that flags failure"
              icon="options-outline"
            />
          </View>

          <SectionHeader
            title="Model cards"
            icon="list-outline"
            subtitle="Accuracy first, then the dataset, folds, confusion matrix and limitations behind it."
          />

          {data.count === 0 ? (
            <EmptyState
              icon="flask-outline"
              title="No model cards are loaded"
              message="Run the training script to write model weights into backend/data/models."
            />
          ) : null}

          {data.models.map((card) => (
            <MlModelCardView key={card.id} card={card} />
          ))}

          <PredictPanel decisionThreshold={data.decisionThreshold} />
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.space.xs
  },
  cardHeadText: {
    flex: 1,
    marginRight: theme.space.sm
  },
  cardName: {
    ...theme.font.cardTitle,
    color: theme.text
  },
  classTitle: {
    ...theme.font.cardTitle,
    color: theme.text,
    flexShrink: 1,
    marginRight: theme.space.sm
  },
  statRow: {
    flexDirection: 'row',
    gap: theme.space.md,
    marginTop: theme.space.md
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    marginTop: theme.space.md
  },
  bullet: {
    ...theme.font.caption,
    color: theme.textMuted,
    lineHeight: 18,
    marginBottom: theme.space.xxs
  },
  classBlock: {
    borderLeftWidth: 3,
    borderLeftColor: theme.primaryBorder,
    paddingLeft: theme.space.md,
    marginTop: theme.space.md
  },
  matrix: {
    marginTop: theme.space.sm,
    marginBottom: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: '#ffffff'
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.divider
  },
  matrixCell: {
    flex: 1,
    ...theme.font.caption,
    color: theme.text,
    textAlign: 'right',
    paddingVertical: 6,
    paddingHorizontal: theme.space.xs
  },
  matrixLabel: {
    flex: 1.6,
    textAlign: 'left',
    color: theme.textMuted,
    fontWeight: '700'
  },
  matrixHead: {
    color: theme.textMuted,
    fontWeight: '700'
  },
  presetRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.sm,
    marginBottom: theme.space.md
  },
  presetItem: {
    flex: 1
  }
});
