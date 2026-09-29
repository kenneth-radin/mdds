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
import { MlModelList, MlOperatingParameters, MlPredictResponse } from '../../../lib/types';
import { fmtNumber, isValidNumberInput, toNumberOrNull } from '../../../lib/format';

const pct = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

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
 * Defaults sit in the middle of the measured AI4I 2020 feature ranges (air
 * 295.3-304.5 K, process 305.7-313.8 K, speed 1168-2886 rpm, torque 3.8-76.6 Nm,
 * wear 0-253 min) so the first run is meaningful. Every field stays editable.
 */
const DEFAULT_VALUES: MlOperatingParameters = {
  airTemperatureK: 298.1,
  processTemperatureK: 308.6,
  rotationalSpeedRpm: 1551,
  torqueNm: 39.8,
  toolWearMin: 108,
  productType: 'L'
};

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

/**
 * Runs the Layer 3 classifiers on the entered parameters. Nothing is written to
 * the database, and the decision threshold that flags a result comes from the
 * model list endpoint rather than a hard-coded value.
 */
function PredictPanel({ decisionThreshold }: { decisionThreshold?: number }) {
  const [form, setForm] = useState<NumericForm>(() => toForm(DEFAULT_VALUES));
  const [productType, setProductType] = useState<MlOperatingParameters['productType']>(
    DEFAULT_VALUES.productType
  );
  const [result, setResult] = useState<MlPredictResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const blankFields = NUMERIC_FIELDS.filter((field) => !form[field.key].trim());
  const badFields = NUMERIC_FIELDS.filter((field) => form[field.key].trim() && !isValidNumberInput(form[field.key]));

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
      <SectionHeader title="Predict failure risk" icon="sparkles-outline" />

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

      <Button title="Run prediction" icon="play-outline" loading={busy} onPress={run} />

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

/**
 * Each model's probability is shown together with the measured metrics behind
 * it, and the technical detail (exact feature vector, limitations) stays
 * collapsed behind a tap.
 */
function PredictResults({
  result,
  decisionThreshold
}: {
  result: MlPredictResponse;
  decisionThreshold?: number;
}) {
  const flagged = result.results.filter((entry) => entry.flagged).length;

  return (
    <>
      <SectionHeader
        title="Prediction results"
        icon="analytics-outline"
        subtitle={
          decisionThreshold !== undefined
            ? `${result.analysisMethod} · flagged when the probability reaches ${pct(decisionThreshold)}`
            : result.analysisMethod
        }
      />

      <View style={st.statRow}>
        <StatCard label="Models run" value={String(result.results.length)} icon="hardware-chip-outline" />
        <StatCard
          label="Flagged"
          value={String(flagged)}
          hint="at or above the decision threshold"
          icon="warning-outline"
          tone={flagged ? 'warning' : 'default'}
        />
        {decisionThreshold !== undefined ? (
          <StatCard label="Threshold" value={pct(decisionThreshold)} icon="options-outline" />
        ) : null}
      </View>

      {result.results.map((entry) => {
        const appliedThreshold = entry.decisionThreshold ?? decisionThreshold;
        return (
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
                  {appliedThreshold !== undefined ? (
                    <StatCard
                      label="Threshold applied"
                      value={pct(appliedThreshold)}
                      hint="probability that flags failure"
                    />
                  ) : null}
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
        );
      })}

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

  return (
    <Screen>
      <ScreenHeader
        title="AI predictions"
        subtitle="Score operating parameters to get a failure probability from the trained benchmark classifiers."
      />

      {error ? (
        <Notice tone="warning" title="Model list unavailable — predictions may still run">
          {error}
        </Notice>
      ) : null}

      {loading && !data ? (
        <Loading label="Loading models…" />
      ) : (
        <PredictPanel decisionThreshold={data?.decisionThreshold} />
      )}
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
  classTitle: {
    ...theme.font.cardTitle,
    color: theme.text,
    flexShrink: 1,
    marginRight: theme.space.sm
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
    marginTop: theme.space.md
  },
  bullet: {
    ...theme.font.caption,
    color: theme.textMuted,
    lineHeight: 18,
    marginBottom: theme.space.xxs
  }
});
