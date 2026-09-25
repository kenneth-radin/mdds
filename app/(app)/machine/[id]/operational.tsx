import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, EmptyState, Field, Muted, Notice, Screen, Subtitle, Title } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { OperationalRecord } from '../../../../lib/types';
import { fmtDate } from '../../../../lib/format';

export default function OperationalDataScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<OperationalRecord[]>([]);
  const [form, setForm] = useState({ date: '', operatingHours: '', productionOutput: '', downtime: '', energy: '', notes: '' });
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ records: OperationalRecord[] }>(`/api/machines/${id}/operational-data`);
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
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await api.post('/api/operational-data', {
        machine: id,
        date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
        operatingHours: form.operatingHours ? Number(form.operatingHours) : 0,
        productionOutput: form.productionOutput ? Number(form.productionOutput) : null,
        downtimeHours: form.downtime ? Number(form.downtime) : 0,
        energyKwh: form.energy ? Number(form.energy) : null,
        notes: form.notes.trim()
      });
      setForm({ date: '', operatingHours: '', productionOutput: '', downtime: '', energy: '', notes: '' });
      setFeedback('Operational data saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Operational data</Title>
      <Subtitle>Operating hours, output, downtime and energy records.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {feedback ? <Notice tone="success">{feedback}</Notice> : null}
      <Card>
        <Field label="Date (YYYY-MM-DD)" value={form.date} onChangeText={set('date')} placeholder="2025-03-10" />
        <Field label="Operating hours" value={form.operatingHours} onChangeText={set('operatingHours')} keyboardType="numeric" />
        <Field label="Production output" value={form.productionOutput} onChangeText={set('productionOutput')} keyboardType="numeric" />
        <Field label="Downtime (hours)" value={form.downtime} onChangeText={set('downtime')} keyboardType="numeric" />
        <Field label="Energy (kWh)" value={form.energy} onChangeText={set('energy')} keyboardType="numeric" />
        <Field label="Notes" value={form.notes} onChangeText={set('notes')} />
        <Button title={busy ? 'Saving…' : 'Save operational record'} onPress={submit} disabled={busy} />
      </Card>
      {records.length === 0 ? (
        <EmptyState title="No operational data recorded yet." />
      ) : (
        records.map((record) => (
          <Card key={record._id}>
            <Title>{fmtDate(record.date)}</Title>
            <Muted>Operating hours: {record.operatingHours}</Muted>
            <Muted>Production output: {record.productionOutput ?? '—'}</Muted>
            <Muted>Downtime: {record.downtimeHours} h</Muted>
            <Muted>Energy: {record.energyKwh ?? '—'} kWh</Muted>
            <Badge text="operational" />
          </Card>
        ))
      )}
    </Screen>
  );
}
