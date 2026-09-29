import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Badge,
  Button,
  Card,
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
import { OperationalRecord } from '../../../../lib/types';
import { fmtDate, fmtNumber, isValidDateInput, isValidNumberInput, toIsoOrNull, toNumberOrNull } from '../../../../lib/format';

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
    if (form.date.trim() && !isValidDateInput(form.date)) {
      setError('Date must look like 2025-03-10.');
      return;
    }
    if (!isValidNumberInput(form.operatingHours)) {
      setError('Operating hours must be a number.');
      return;
    }
    if (!isValidNumberInput(form.productionOutput)) {
      setError('Production output must be a number.');
      return;
    }
    if (!isValidNumberInput(form.downtime)) {
      setError('Downtime must be a number.');
      return;
    }
    if (!isValidNumberInput(form.energy)) {
      setError('Energy must be a number.');
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await api.post('/api/operational-data', {
        machine: id,
        date: toIsoOrNull(form.date) || new Date().toISOString(),
        operatingHours: toNumberOrNull(form.operatingHours) ?? 0,
        productionOutput: toNumberOrNull(form.productionOutput),
        downtimeHours: toNumberOrNull(form.downtime) ?? 0,
        energyKwh: toNumberOrNull(form.energy),
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

  const removeRecord = (record: OperationalRecord) => {
    Alert.alert(
      'Remove operational record',
      `Delete the operational reading for ${fmtDate(record.date)}? History statistics will be recalculated without it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setFeedback('');
            try {
              await api.del(`/api/operational-data/${record._id}`);
              setFeedback('Operational record removed.');
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
        title="Operational data"
        subtitle="Operating hours, output, downtime and energy — the running context around each failure."
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
          title="Add an operational record"
          icon="pulse-outline"
          subtitle="One row per shift, day or reading period"
        />
        <Field
          label="Date (YYYY-MM-DD)"
          value={form.date}
          onChangeText={set('date')}
          placeholder="2025-03-10"
          helper="Leave blank to use today's date."
        />
        <Field
          label="Operating hours"
          value={form.operatingHours}
          onChangeText={set('operatingHours')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field
          label="Production output"
          value={form.productionOutput}
          onChangeText={set('productionOutput')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field
          label="Downtime (hours)"
          value={form.downtime}
          onChangeText={set('downtime')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field
          label="Energy (kWh)"
          value={form.energy}
          onChangeText={set('energy')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Optional" multiline />
        <Button title="Save operational record" icon="checkmark-outline" loading={busy} onPress={submit} />
      </Card>

      <SectionHeader
        title="Recorded operational data"
        icon="list-outline"
        subtitle="Used for energy and downtime context, not for the text-based matching."
      />

      {records.length === 0 ? (
        <EmptyState
          icon="pulse-outline"
          title="No operational data yet"
          message="Add the first operational record above to give the history statistics something to work with."
        />
      ) : (
        records.map((record) => (
          <Card key={record._id}>
            <View style={st.rowHead}>
              <Text style={st.rowTitle}>{fmtDate(record.date)}</Text>
              <Badge text="operational" tone="info" />
            </View>
            <KeyValue label="Operating hours" value={fmtNumber(record.operatingHours)} />
            <KeyValue
              label="Production output"
              value={record.productionOutput === null ? '—' : fmtNumber(record.productionOutput)}
            />
            <KeyValue label="Downtime" value={`${fmtNumber(record.downtimeHours)} h`} />
            <KeyValue
              label="Energy"
              value={record.energyKwh === null ? '—' : `${fmtNumber(record.energyKwh)} kWh`}
            />
            {record.notes ? <KeyValue label="Notes" value={record.notes} /> : null}
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
  }
});
