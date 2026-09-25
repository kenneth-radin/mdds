import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Field, Loading, Muted, Notice, Screen, Subtitle, Title } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { MaintenanceCase } from '../../../../lib/types';
import { splitCsv } from '../../../../lib/format';

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
    setBusy(true);
    setError('');
    try {
      await api.put(`/api/maintenance-cases/${id}/outcome`, {
        result,
        actionTaken: form.actionTaken.trim(),
        partsReplaced: splitCsv(form.parts),
        downtimeHours: form.downtime ? Number(form.downtime) : null,
        technician: form.technician.trim(),
        cost: form.cost ? Number(form.cost) : null,
        productionLossUnits: form.loss ? Number(form.loss) : null,
        notes: form.notes.trim()
      });
      router.replace(`/(app)/case/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!item) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <Title>Record actual maintenance</Title>
      <Subtitle>{item.caseNumber} · completing this case makes it available as historical data for future analyses.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Card>
        <Muted>Outcome</Muted>
        {results.map((value) => (
          <Pressable key={value} onPress={() => setResult(value)}>
            <Title>{result === value ? '◉' : '○'} {value}</Title>
          </Pressable>
        ))}
        <Field label="Actual maintenance action taken *" value={form.actionTaken} onChangeText={set('actionTaken')} placeholder="What was actually done" />
        <Field label="Parts replaced (comma separated)" value={form.parts} onChangeText={set('parts')} />
        <Field label="Downtime (hours)" value={form.downtime} onChangeText={set('downtime')} keyboardType="numeric" />
        <Field label="Technician" value={form.technician} onChangeText={set('technician')} />
        <Field label="Cost" value={form.cost} onChangeText={set('cost')} keyboardType="numeric" />
        <Field label="Production loss (units)" value={form.loss} onChangeText={set('loss')} keyboardType="numeric" />
        <Field label="Notes" value={form.notes} onChangeText={set('notes')} />
        <Button title={busy ? 'Saving…' : 'Save outcome and complete case'} onPress={submit} disabled={busy} />
      </Card>
    </Screen>
  );
}
