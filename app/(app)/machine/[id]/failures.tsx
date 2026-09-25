import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, EmptyState, Field, Muted, Notice, Screen, Subtitle, Title } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { FailureRecord } from '../../../../lib/types';
import { fmtDate, splitCsv, toIsoOrNull } from '../../../../lib/format';

const severities = ['minor', 'moderate', 'major', 'critical'] as const;

export default function FailureRecordsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<FailureRecord[]>([]);
  const [form, setForm] = useState({ date: '', failureMode: '', cause: '', symptoms: '', downtime: '', correctiveAction: '', notes: '' });
  const [severity, setSeverity] = useState<(typeof severities)[number]>('moderate');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ records: FailureRecord[] }>(`/api/machines/${id}/failures`);
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
      await api.post('/api/failures', {
        machine: id,
        date: toIsoOrNull(form.date) || new Date().toISOString(),
        failureMode: form.failureMode.trim(),
        cause: form.cause.trim(),
        symptoms: splitCsv(form.symptoms),
        severity,
        downtimeHours: form.downtime ? Number(form.downtime) : 0,
        correctiveAction: form.correctiveAction.trim(),
        notes: form.notes.trim()
      });
      setForm({ date: '', failureMode: '', cause: '', symptoms: '', downtime: '', correctiveAction: '', notes: '' });
      setFeedback('Failure record saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Failure records</Title>
      <Subtitle>Recorded failures feed MTBF, MTTR and failure-frequency calculations.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {feedback ? <Notice tone="success">{feedback}</Notice> : null}
      <Card>
        <Field label="Date (YYYY-MM-DD)" value={form.date} onChangeText={set('date')} placeholder="2025-02-05" />
        <Field label="Failure mode *" value={form.failureMode} onChangeText={set('failureMode')} placeholder="Bearing seizure" />
        <Field label="Cause" value={form.cause} onChangeText={set('cause')} placeholder="Insufficient lubrication" />
        <Field label="Symptoms (comma separated)" value={form.symptoms} onChangeText={set('symptoms')} placeholder="noise, heat, vibration" />
        <Muted>Severity</Muted>
        {severities.map((item) => (
          <Pressable key={item} onPress={() => setSeverity(item)}>
            <Title>{severity === item ? '◉' : '○'} {item}</Title>
          </Pressable>
        ))}
        <Field label="Downtime (hours)" value={form.downtime} onChangeText={set('downtime')} keyboardType="numeric" />
        <Field label="Corrective action" value={form.correctiveAction} onChangeText={set('correctiveAction')} placeholder="Replaced bearing" />
        <Field label="Notes" value={form.notes} onChangeText={set('notes')} />
        <Button title={busy ? 'Saving…' : 'Save failure record'} onPress={submit} disabled={busy} />
      </Card>
      {records.length === 0 ? (
        <EmptyState title="No failure records available." />
      ) : (
        records.map((record) => (
          <Card key={record._id}>
            <Title>{fmtDate(record.date)} · {record.failureMode}</Title>
            <Muted>Cause: {record.cause || '—'}</Muted>
            <Muted>Symptoms: {record.symptoms.length ? record.symptoms.join(', ') : '—'}</Muted>
            <Muted>Downtime: {record.downtimeHours} h</Muted>
            <Muted>Corrective action: {record.correctiveAction || '—'}</Muted>
            <Badge text={record.severity} tone={record.severity === 'critical' ? 'danger' : 'warning'} />
          </Card>
        ))
      )}
    </Screen>
  );
}
