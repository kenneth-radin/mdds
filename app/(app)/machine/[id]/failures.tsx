import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Chip,
  ChoiceGroup,
  Divider,
  EmptyState,
  Field,
  KeyValue,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  theme
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { FailureRecord } from '../../../../lib/types';
import { fmtDate, fmtNumber, isValidDateInput, isValidNumberInput, splitCsv, toIsoOrNull, toNumberOrNull } from '../../../../lib/format';

const severities = ['minor', 'moderate', 'major', 'critical'] as const;

function severityTone(severity: FailureRecord['severity']) {
  if (severity === 'critical') return 'danger' as const;
  if (severity === 'major') return 'warning' as const;
  return 'info' as const;
}

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
    if (!form.failureMode.trim()) {
      setError('Failure mode is required.');
      return;
    }
    if (form.date.trim() && !isValidDateInput(form.date)) {
      setError('Date must look like 2025-02-05.');
      return;
    }
    if (!isValidNumberInput(form.downtime)) {
      setError('Downtime must be a number.');
      return;
    }
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
        downtimeHours: toNumberOrNull(form.downtime) ?? 0,
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

  const removeRecord = (record: FailureRecord) => {
    Alert.alert(
      'Remove failure record',
      `Delete the ${fmtDate(record.date)} "${record.failureMode}" record? MTBF and failure-frequency figures will change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setFeedback('');
            try {
              await api.del(`/api/failures/${record._id}`);
              setFeedback('Failure record removed.');
              await load();
            } catch (err) {
              setError(errorMessage(err));
            }
          }
        }
      ]
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title="Failure records"
        subtitle="Recorded failures feed the MTBF, MTTR and failure-frequency figures in every analysis."
        badge={records.length ? <Badge text={`${records.length} records`} tone="info" /> : undefined}
      />

      {error ? (
        <Notice tone="danger" title="Could not save or load">
          {error}
        </Notice>
      ) : null}
      {feedback ? (
        <Notice tone="success" title="Saved">
          {feedback}
        </Notice>
      ) : null}

      <Card>
        <SectionHeader
          title="Add a failure record"
          icon="warning-outline"
          subtitle="What broke, why, and what was done about it"
        />
        <Field
          label="Date (YYYY-MM-DD)"
          value={form.date}
          onChangeText={set('date')}
          placeholder="2025-02-05"
          helper="Leave blank to use today's date."
        />
        <Field
          label="Failure mode"
          value={form.failureMode}
          onChangeText={set('failureMode')}
          placeholder="Bearing seizure"
          required
        />
        <Field
          label="Cause"
          value={form.cause}
          onChangeText={set('cause')}
          placeholder="Insufficient lubrication"
        />
        <Field
          label="Symptoms (comma separated)"
          value={form.symptoms}
          onChangeText={set('symptoms')}
          placeholder="noise, heat, vibration"
          helper="Symptoms are matched against the wording of future cases."
        />
        <ChoiceGroup
          label="Severity"
          value={severity}
          options={[
            { value: 'minor', label: 'Minor', hint: 'Noticeable but not limiting' },
            { value: 'moderate', label: 'Moderate', hint: 'Reduced performance' },
            { value: 'major', label: 'Major', hint: 'Production affected' },
            { value: 'critical', label: 'Critical', hint: 'Line stopped or safety risk' }
          ]}
          onChange={(value) => setSeverity(value)}
        />
        <Field
          label="Downtime (hours)"
          value={form.downtime}
          onChangeText={set('downtime')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field
          label="Corrective action"
          value={form.correctiveAction}
          onChangeText={set('correctiveAction')}
          placeholder="Replaced bearing"
          multiline
        />
        <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Optional" multiline />
        <Button title="Save failure record" icon="checkmark-outline" loading={busy} onPress={submit} />
      </Card>

      <SectionHeader
        title="Recorded failures"
        icon="list-outline"
        subtitle="Every entry here counts towards this machine's reliability figures."
      />

      {records.length === 0 ? (
        <EmptyState
          icon="warning-outline"
          title="No failure records yet"
          message="Add the first failure above so MTBF and failure-mode statistics can be calculated."
        />
      ) : (
        records.map((record) => (
          <Card key={record._id}>
            <View style={st.rowHead}>
              <Text style={st.rowTitle}>
                {fmtDate(record.date)} · {record.failureMode}
              </Text>
              <Badge text={record.severity} tone={severityTone(record.severity)} />
            </View>
            <KeyValue label="Cause" value={record.cause || '—'} />
            <KeyValue
              label="Symptoms"
              value={record.symptoms.length ? record.symptoms.join(', ') : '—'}
            />
            <KeyValue label="Corrective action" value={record.correctiveAction || '—'} />
            {record.notes ? <KeyValue label="Notes" value={record.notes} /> : null}
            <View style={st.chipRow}>
              <Chip label={`${fmtNumber(record.downtimeHours)} h downtime`} icon="time-outline" />
            </View>
            <Divider />
            <Button
              title="Remove record"
              variant="ghost"
              icon="trash-outline"
              onPress={() => removeRecord(record)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  rowHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.space.xs
  },
  rowTitle: {
    ...theme.font.cardTitle,
    color: theme.text,
    flex: 1,
    marginRight: theme.space.sm
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    marginTop: theme.space.sm
  }
});
