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
import { MaintenanceRecord } from '../../../../lib/types';
import { fmtDate, fmtNumber, isValidDateInput, isValidNumberInput, splitCsv, toIsoOrNull, toNumberOrNull } from '../../../../lib/format';

const types = ['preventive', 'corrective', 'predictive', 'inspection', 'overhaul'] as const;

const TYPE_HINTS: Record<(typeof types)[number], string> = {
  preventive: 'Scheduled work before a failure',
  corrective: 'Repair after a failure occurred',
  predictive: 'Work triggered by a condition signal',
  inspection: 'Check without repair',
  overhaul: 'Major strip-down and rebuild'
};

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
        downtimeHours: toNumberOrNull(form.downtime) ?? 0,
        cost: toNumberOrNull(form.cost),
        productionLossUnits: toNumberOrNull(form.loss)
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

  const removeRecord = (record: MaintenanceRecord) => {
    Alert.alert(
      'Remove maintenance record',
      `Delete the ${fmtDate(record.date)} ${record.maintenanceType} record? Future analyses will no longer see it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setFeedback('');
            try {
              await api.del(`/api/maintenance/${record._id}`);
              setFeedback('Maintenance record removed.');
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
        title="Maintenance history"
        subtitle="Real historical maintenance records. The analysis engine reads these first when it looks for similar past jobs."
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
          title="Add a maintenance record"
          icon="build-outline"
          subtitle="Write the problem and the action the way a technician would say them."
        />
        <Field
          label="Date (YYYY-MM-DD)"
          value={form.date}
          onChangeText={set('date')}
          placeholder="2025-01-20"
          helper="Leave blank to use today's date."
        />
        <ChoiceGroup
          label="Maintenance type"
          value={type}
          options={types.map((item) => ({ value: item, label: item, hint: TYPE_HINTS[item] }))}
          onChange={(value) => setType(value)}
        />
        <Field
          label="Problem / symptoms"
          value={form.problem}
          onChangeText={set('problem')}
          placeholder="Abnormal noise and vibration at bearing"
          required
          multiline
        />
        <Field
          label="Action taken"
          value={form.action}
          onChangeText={set('action')}
          placeholder="Replaced bearing and realigned coupling"
          required
          multiline
        />
        <Field
          label="Parts replaced (comma separated)"
          value={form.parts}
          onChangeText={set('parts')}
          placeholder="bearing, seal"
        />
        <Field
          label="Technician"
          value={form.technician}
          onChangeText={set('technician')}
          placeholder="Who performed the work"
        />
        <Field
          label="Downtime (hours)"
          value={form.downtime}
          onChangeText={set('downtime')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field label="Cost" value={form.cost} onChangeText={set('cost')} keyboardType="numeric" placeholder="0" />
        <Field
          label="Production loss (units)"
          value={form.loss}
          onChangeText={set('loss')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Button
          title="Save maintenance record"
          icon="checkmark-outline"
          loading={busy}
          onPress={submit}
        />
      </Card>

      <SectionHeader
        title="Recorded jobs"
        icon="list-outline"
        subtitle="Most recent records first, exactly as the analysis reads them."
      />

      {records.length === 0 ? (
        <EmptyState
          icon="build-outline"
          title="No maintenance history yet"
          message="Add the first maintenance record above so future analyses have something to compare against."
        />
      ) : (
        records.map((record) => (
          <Card key={record._id}>
            <View style={st.rowHead}>
              <Text style={st.rowTitle}>{fmtDate(record.date)}</Text>
              <Badge text={record.maintenanceType} tone="info" />
            </View>
            <KeyValue label="Problem" value={record.problem} />
            <KeyValue label="Action" value={record.action} />
            <KeyValue
              label="Parts replaced"
              value={record.partsReplaced.length ? record.partsReplaced.join(', ') : '—'}
            />
            {record.cost !== null ? <KeyValue label="Cost" value={fmtNumber(record.cost)} /> : null}
            {record.productionLossUnits !== null ? (
              <KeyValue label="Production loss" value={fmtNumber(record.productionLossUnits)} />
            ) : null}
            {record.notes ? <KeyValue label="Notes" value={record.notes} /> : null}
            <View style={st.chipRow}>
              <Chip label={`${fmtNumber(record.downtimeHours)} h downtime`} icon="time-outline" />
              {record.technician ? <Chip label={record.technician} icon="person-outline" /> : null}
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
