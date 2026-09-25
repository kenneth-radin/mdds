import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, EmptyState, Field, Muted, Notice, Screen, Subtitle, Title } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { MaintenanceRecord } from '../../../../lib/types';
import { fmtDate, isValidDateInput, splitCsv, toIsoOrNull } from '../../../../lib/format';

const types = ['preventive', 'corrective', 'predictive', 'inspection', 'overhaul'] as const;

export default function MaintenanceHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [form, setForm] = useState({ date: '', problem: '', action: '', parts: '', technician: '', downtime: '', cost: '', loss: '' });
  const [type, setType] = useState<(typeof types)[number]>('corrective');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ records: MaintenanceRecord[] }>(`/api/machines/${id}/maintenance`);
      setRecords(result.records);
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
    if (!form.problem.trim() || !form.action.trim()) {
      setError('Problem / symptoms and action taken are required.');
      return;
    }
    if (form.date.trim() && !isValidDateInput(form.date)) {
      setError('Date must look like 2025-01-20.');
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await api.post('/api/maintenance', {
        machine: id,
        date: toIsoOrNull(form.date) || new Date().toISOString(),
        maintenanceType: type,
        problem: form.problem.trim(),
        action: form.action.trim(),
        partsReplaced: splitCsv(form.parts),
        technician: form.technician.trim(),
        downtimeHours: form.downtime ? Number(form.downtime) : 0,
        cost: form.cost ? Number(form.cost) : null,
        productionLossUnits: form.loss ? Number(form.loss) : null
      });
      setForm({ date: '', problem: '', action: '', parts: '', technician: '', downtime: '', cost: '', loss: '' });
      setFeedback('Maintenance record saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Maintenance history</Title>
      <Subtitle>Record real historical maintenance data used by the analysis engine.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {feedback ? <Notice tone="success">{feedback}</Notice> : null}
      <Card>
        <Field label="Date (YYYY-MM-DD)" value={form.date} onChangeText={set('date')} placeholder="2025-01-20" />
        <Muted>Maintenance type</Muted>
        {types.map((item) => (
          <Pressable key={item} onPress={() => setType(item)}>
            <Title>{type === item ? '◉' : '○'} {item}</Title>
          </Pressable>
        ))}
        <Field label="Problem / symptoms *" value={form.problem} onChangeText={set('problem')} placeholder="Abnormal noise and vibration at bearing" />
        <Field label="Action taken *" value={form.action} onChangeText={set('action')} placeholder="Replaced bearing and realigned coupling" />
        <Field label="Parts replaced (comma separated)" value={form.parts} onChangeText={set('parts')} placeholder="bearing, seal" />
        <Field label="Technician" value={form.technician} onChangeText={set('technician')} />
        <Field label="Downtime (hours)" value={form.downtime} onChangeText={set('downtime')} keyboardType="numeric" />
        <Field label="Cost" value={form.cost} onChangeText={set('cost')} keyboardType="numeric" />
        <Field label="Production loss (units)" value={form.loss} onChangeText={set('loss')} keyboardType="numeric" />
        <Button title={busy ? 'Saving…' : 'Save maintenance record'} onPress={submit} disabled={busy} />
      </Card>
      {records.length === 0 ? (
        <EmptyState title="No maintenance history available." />
      ) : (
        records.map((record) => (
          <Card key={record._id}>
            <Title>{fmtDate(record.date)} · {record.maintenanceType}</Title>
            <Muted>Problem: {record.problem}</Muted>
            <Muted>Action: {record.action}</Muted>
            <Muted>Parts: {record.partsReplaced.length ? record.partsReplaced.join(', ') : '—'}</Muted>
            <Muted>Downtime: {record.downtimeHours} h</Muted>
            <Badge text={record.maintenanceType} />
          </Card>
        ))
      )}
    </Screen>
  );
}
