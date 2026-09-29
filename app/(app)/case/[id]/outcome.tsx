import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Card,
  ChoiceGroup,
  Field,
  Loading,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { MaintenanceCase } from '../../../../lib/types';
import { isValidNumberInput, splitCsv, toNumberOrNull, humanize } from '../../../../lib/format';

const results = ['resolved', 'partially-resolved', 'not-resolved'] as const;

export default function CaseOutcomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<MaintenanceCase | null>(null);
  const [result, setResult] = useState<(typeof results)[number]>('resolved');
  const [form, setForm] = useState({ actionTaken: '', parts: '', downtime: '', technician: '', cost: '', loss: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ maintenanceCase: MaintenanceCase }>(`/api/maintenance-cases/${id}`);
      const maintenanceCase = response.maintenanceCase;
      setItem(maintenanceCase);
      const suggestion =
        maintenanceCase.review.modifiedSuggestion || maintenanceCase.analysis.suggestions[0]?.recommendedAction || '';
      setForm((prev) => ({
        ...prev,
        actionTaken: maintenanceCase.actualAction.actionTaken || suggestion,
        parts: maintenanceCase.actualAction.partsReplaced?.join(', ') || ''
      }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!form.actionTaken.trim()) {
      setError('Action taken is required.');
      return;
    }
    if (!isValidNumberInput(form.downtime)) {
      setError('Downtime must be a number.');
      return;
    }
    if (!isValidNumberInput(form.cost)) {
      setError('Cost must be a number.');
      return;
    }
    if (!isValidNumberInput(form.loss)) {
      setError('Production loss must be a number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.put(`/api/maintenance-cases/${id}/outcome`, {
        result,
        actionTaken: form.actionTaken.trim(),
        partsReplaced: splitCsv(form.parts),
        downtimeHours: toNumberOrNull(form.downtime),
        technician: form.technician.trim(),
        cost: toNumberOrNull(form.cost),
        productionLossUnits: toNumberOrNull(form.loss),
        notes: form.notes.trim()
      });
      router.replace(`/(app)/case/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!item) {
    return (
      <Screen>
        <Loading label="Loading the case…" caption="Fetching the case so the outcome can be recorded against it." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Record actual maintenance"
        subtitle={`${item.caseNumber} · completing this case makes it available as historical evidence for future analyses.`}
      />

      {error ? (
        <Notice tone="danger" title="Could not save the outcome">
          {error}
        </Notice>
      ) : null}

      <Card>
        <SectionHeader
          title="What was done"
          icon="build-outline"
          subtitle="These values become the machine's history the analyser reads next time."
        />

        <ChoiceGroup
          label="Outcome"
          value={result}
          options={results.map((value) => ({
            value,
            label: humanize(value),
            hint:
              value === 'resolved'
                ? 'Machine is back to full service'
                : value === 'partially-resolved'
                ? 'Improved, but follow-up may be needed'
                : 'Problem persists after the work'
          }))}
          onChange={(value) => setResult(value)}
        />

        <Field
          label="Actual maintenance action taken"
          value={form.actionTaken}
          onChangeText={set('actionTaken')}
          placeholder="What was actually done"
          helper="Pre-filled with the reviewed suggestion when one exists — edit it to match reality."
          required
          multiline
        />
        <Field
          label="Parts replaced (comma separated)"
          value={form.parts}
          onChangeText={set('parts')}
          placeholder="bearing, coupling"
        />
        <Field
          label="Downtime (hours)"
          value={form.downtime}
          onChangeText={set('downtime')}
          keyboardType="numeric"
          placeholder="4.5"
        />
        <Field label="Technician" value={form.technician} onChangeText={set('technician')} placeholder="Who performed the work" />
        <Field label="Cost" value={form.cost} onChangeText={set('cost')} keyboardType="numeric" placeholder="0" />
        <Field
          label="Production loss (units)"
          value={form.loss}
          onChangeText={set('loss')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Anything worth remembering" multiline />

        <Muted>
          Saving marks the case as completed, so it can be matched against future problems reported on this machine.
        </Muted>

        <Button
          title="Save outcome and complete case"
          icon="checkmark-done-outline"
          loading={busy}
          onPress={submit}
        />
      </Card>
    </Screen>
  );
}
