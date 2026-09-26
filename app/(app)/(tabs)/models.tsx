import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Screen,
  Subtitle,
  Title,
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
  const [open, setOpen] = useState(false);
  const trained = card.status === 'trained';
  const evaluation = card.evaluation;
  const belowBaseline = evaluation ? evaluation.accuracy < evaluation.majorityClassBaseline : false;

  return (
    <Card>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button">
        <View style={st.cardHead}>
          <Text style={st.cardName}>{card.name}</Text>
          <Badge text={trained ? 'trained' : 'unavailable'} tone={trained ? 'success' : 'warning'} />
        </View>
        <Muted>{card.description}</Muted>
        <Muted>{open ? 'Tap to hide the model card ▾' : 'Tap to show the full model card ▸'}</Muted>
      </Pressable>

      {!trained ? <Muted>{card.reason ?? 'Model weights are not loaded.'}</Muted> : null}

      {trained && evaluation ? (
        <>
          <Divider />
          <KeyValue label="Accuracy" value={pct(evaluation.accuracy)} />
          <KeyValue label="Majority-class baseline" value={pct(evaluation.majorityClassBaseline)} />
          <KeyValue label="Accuracy vs baseline" value={points(evaluation.accuracy - evaluation.majorityClassBaseline)} />
          <KeyValue label="Macro-F1" value={pct(evaluation.macroF1)} />
          <KeyValue label="Weighted-F1" value={pct(evaluation.weightedF1)} />
          <KeyValue label="Evaluated on" value={`${evaluation.samples} rows`} />
          {belowBaseline ? (
            <Notice tone="warning">
              Accuracy is below the majority-class baseline on purpose. Balanced class weighting trades specificity for
              recall, because a model that always answered &quot;no failure&quot; would score {pct(evaluation.majorityClassBaseline)}{' '}
              while catching nothing. Read precision, recall and the confusion matrix below.
            </Notice>
          ) : null}
        </>
      ) : null}

      {open ? <MlModelCardDetails card={card} /> : null}
    </Card>
  );
}

/** Everything below the fold: provenance, training, per-class metrics, limitations. */
function MlModelCardDetails({ card }: { card: MlModelCard }) {
  const evaluation = card.evaluation;

  return (
    <>
      <Divider />
      <Muted>Identity</Muted>
      <KeyValue label="Kind" value={card.kind} />
      <KeyValue label="Task" value={card.task} />
      <KeyValue label="Layer" value={String(card.layer)} />
      <KeyValue label="Model id" value={card.id} />
      <KeyValue label="Trained at" value={fmtDateTime(card.trainedAt)} />

      <Divider />
      <Muted>Dataset</Muted>
      {card.dataset ? (
        <>
          <KeyValue label="Name" value={card.dataset.name} />
          <KeyValue label="Source" value={card.dataset.source} />
          <KeyValue label="Licence" value={card.dataset.license} />
          <KeyValue label="Synthetic" value={card.dataset.synthetic ? 'Yes — not measured here' : 'No'} />
          <KeyValue label="Rows" value={String(card.dataset.samples)} />
          {Object.entries(card.dataset.classBalance).map(([label, count]) => (
            <KeyValue key={label} label={`Class ${label}`} value={String(count)} />
          ))}
          <Muted>{card.dataset.note}</Muted>
          <Muted>Citation: {card.dataset.citation}</Muted>
        </>
      ) : (
        <Muted>No dataset information supplied for this model.</Muted>
      )}

      <Divider />
      <Muted>Input features</Muted>
      <Muted>{card.features.join(', ')}</Muted>

      {card.training ? (
        <>
          <Divider />
          <Muted>Training</Muted>
          <KeyValue label="Rows used" value={String(card.training.samples)} />
          <KeyValue label="Features" value={String(card.training.features)} />
          <KeyValue label="Classes" value={String(card.training.classes)} />
          <KeyValue label="Epochs run" value={`${card.training.stoppedAtEpoch} of ${card.training.epochs}`} />
          <KeyValue label="Learning rate" value={String(card.training.learningRate)} />
          <KeyValue label="L2 penalty" value={String(card.training.l2)} />
        </>
      ) : null}

      {evaluation ? <MlModelEvaluation evaluation={evaluation} /> : null}

      <Divider />
      <Muted>Known limitations</Muted>
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
      <Divider />
      <Muted>Evaluation — {evaluation.method}</Muted>
      <KeyValue label="Folds" value={String(evaluation.folds)} />
      <KeyValue label="Random seed" value={String(evaluation.seed)} />
      <KeyValue label="Most common label" value={evaluation.majorityClassLabel} />
      {evaluation.perClass.map((row) => (
        <View key={row.label} style={st.classBlock}>
          <Text style={st.classTitle}>Class {row.label}</Text>
          <KeyValue label="Support" value={String(row.support)} />
          <KeyValue label="Precision" value={pct(row.precision)} />
          <KeyValue label="Recall" value={pct(row.recall)} />
          <KeyValue label="F1" value={pct(row.f1)} />
          <KeyValue label="True / false positives" value={`${row.truePositives} / ${row.falsePositives}`} />
          <KeyValue label="False negatives" value={String(row.falseNegatives)} />
        </View>
      ))}
      <Muted>Confusion matrix — rows = actual, columns = predicted (labels {evaluation.labels.join(', ')})</Muted>
      <View style={st.matrix}>
        <View style={st.matrixRow}>
          <Text style={[st.matrixCell, st.matrixHead]} />
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
    <Card>
      <Text style={st.cardName}>Run the benchmark models</Text>
      <Muted>
        Enter operating parameters to score them with the trained classifiers. This writes nothing to the database.
      </Muted>

      <View style={st.presetRow}>
        {PRESETS.map((preset) => (
          <View key={preset.label} style={st.presetItem}>
            <Button title={preset.label} variant="secondary" onPress={() => applyPreset(preset.values)} />
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

      <Muted>Product type</Muted>
      <View style={st.presetRow}>
        {PRODUCT_TYPES.map((type) => (
          <Pressable
            key={type}
            style={st.presetItem}
            accessibilityRole="radio"
            accessibilityState={{ selected: productType === type }}
            onPress={() => setProductType(type)}
          >
            <Text style={st.radio}>{productType === type ? `◉ ${type}` : `○ ${type}`}</Text>
          </Pressable>
        ))}
      </View>

      <Button title={busy ? 'Running…' : 'Run prediction'} onPress={run} disabled={busy} />
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {result ? <PredictResults result={result} decisionThreshold={decisionThreshold} /> : null}
    </Card>
  );
}

function PredictResults({ result, decisionThreshold }: { result: MlPredictResponse; decisionThreshold: number }) {
  return (
    <>
      <Divider />
      <Muted>{result.analysisMethod}</Muted>
      <Muted>Flagged when the probability reaches {pct(decisionThreshold)}.</Muted>

      {result.results.map((entry) => (
        <View key={entry.modelId} style={st.resultBlock}>
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
              <KeyValue label="Probability of class 1" value={pct(entry.probability)} />
              <KeyValue label="Threshold applied" value={pct(entry.decisionThreshold ?? decisionThreshold)} />
              {entry.evaluation ? (
                <Muted>
                  Measured by {entry.evaluation.method}: accuracy {pct(entry.evaluation.accuracy)} against a{' '}
                  {pct(entry.evaluation.majorityClassBaseline)} baseline, macro-F1{' '}
                  {pct(entry.evaluation.macroF1)}.
                </Muted>
              ) : null}
            </>
          ) : (
            <Muted>{entry.reason ?? 'Model weights are not loaded.'}</Muted>
          )}
        </View>
      ))}

      <Divider />
      <Muted>Derived feature vector sent to the models</Muted>
      {result.features.map((feature) => (
        <KeyValue key={feature.name} label={feature.name} value={fmtNumber(feature.value, 4)} />
      ))}

      <Divider />
      <Muted>Known limitations</Muted>
      {result.limitations.map((limitation) => (
        <Text key={limitation} style={st.bullet}>
          • {limitation}
        </Text>
      ))}
      <Muted>{result.note}</Muted>
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
      <Title>AI failure prediction & models</Title>
      <Subtitle>Predict failure modes from operating parameters using machine learning models trained on benchmark data.</Subtitle>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading && !data ? <Loading label="Loading model cards…" /> : null}

      {data ? (
        <>
          <Notice tone="warning">
            These models are trained on the AI4I 2020 predictive maintenance benchmark (kept separate from your plant records). They provide decision support — maintenance personnel make the final call.
          </Notice>

          <Card>
            <KeyValue label="Models available" value={`${trainedCount} of ${data.count}`} />
            <KeyValue label="Decision threshold" value={pct(data.decisionThreshold)} />
            <Muted>Tap a card to see its dataset, per-class metrics, confusion matrix and stated limitations.</Muted>
          </Card>

          {data.count === 0 ? (
            <EmptyState
              title="No model cards are loaded."
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
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardName: { fontSize: 15, fontWeight: '800', color: theme.text, flexShrink: 1 },
  bullet: { fontSize: 12, color: '#334155', lineHeight: 18, marginBottom: 4 },
  classBlock: { borderLeftWidth: 3, borderLeftColor: theme.border, paddingLeft: 10, marginTop: 8 },
  classTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
  matrix: { marginTop: 6, marginBottom: 6 },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  matrixCell: { flex: 1, fontSize: 12, color: theme.text, textAlign: 'right', paddingVertical: 3, paddingHorizontal: 4 },
  matrixLabel: { flex: 1.6, textAlign: 'left', color: theme.muted, fontWeight: '700' },
  matrixHead: { color: theme.muted, fontWeight: '700' },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
  presetItem: { flex: 1 },
  radio: { fontSize: 13, fontWeight: '700', color: theme.text, paddingVertical: 10, textAlign: 'center' },
  resultBlock: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    backgroundColor: '#fff'
  }
});
