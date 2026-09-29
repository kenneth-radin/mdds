import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActionRow,
  Badge,
  Button,
  Card,
  Chip,
  ChoiceGroup,
  Divider,
  EmptyState,
  Field,
  IconAction,
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

type FailureForm = {
  date: string;
  failureMode: string;
  cause: string;
  symptoms: string;
  downtime: string;
  correctiveAction: string;
  notes: string;
};

const EMPTY_FORM: FailureForm = {
  date: '',
  failureMode: '',
  cause: '',
  symptoms: '',
  downtime: '',
  correctiveAction: '',
  notes: ''
};

const SEVERITY_OPTIONS: Array<{ value: FailureRecord['severity']; label: string; hint: string }> = [
  { value: 'minor', label: 'Minor', hint: 'Noticeable but not limiting' },
  { value: 'moderate', label: 'Moderate', hint: 'Reduced performance' },
  { value: 'major', label: 'Major', hint: 'Production affected' },
  { value: 'critical', label: 'Critical', hint: 'Line stopped or safety risk' }
];

function severityTone(severity: FailureRecord['severity']) {
  if (severity === 'critical') return 'danger' as const;
  if (severity === 'major') return 'warning' as const;
  return 'info' as const;
}

/** Stored ISO timestamp -> the `YYYY-MM-DD` text the date field expects. */
function toDateInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function toNumberInput(value?: number | null): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '' : String(value);
}

/** The field set, shared by the add form and by every inline edit form. */
function FailureFields({
  form,
  onField,
  severity,
  onSeverity
}: {
  form: FailureForm;
  onField: (key: keyof FailureForm) => (value: string) => void;
  severity: FailureRecord['severity'];
  onSeverity: (value: FailureRecord['severity']) => void;
}) {
  return (
    <>
      <Field
        label="Date (YYYY-MM-DD)"
        value={form.date}
        onChangeText={onField('date')}
        placeholder="2025-02-05"
        helper="Leave blank to use today's date."
      />
      <Field
        label="Failure mode"
        value={form.failureMode}
        onChangeText={onField('failureMode')}
        placeholder="Bearing seizure"
        required
      />
      <Field label="Cause" value={form.cause} onChangeText={onField('cause')} placeholder="Insufficient lubrication" />
      <Field
        label="Symptoms (comma separated)"
        value={form.symptoms}
        onChangeText={onField('symptoms')}
        placeholder="noise, heat, vibration"
        helper="Symptoms are matched against the wording of future cases."
      />
      <ChoiceGroup label="Severity" value={severity} options={SEVERITY_OPTIONS} onChange={onSeverity} />
      <Field
        label="Downtime (hours)"
        value={form.downtime}
        onChangeText={onField('downtime')}
        keyboardType="numeric"
        placeholder="0"
      />
      <Field
        label="Corrective action"
        value={form.correctiveAction}
        onChangeText={onField('correctiveAction')}
        placeholder="Replaced bearing"
        multiline
      />
      <Field label="Notes" value={form.notes} onChangeText={onField('notes')} placeholder="Optional" multiline />
    </>
  );
}

/** The message to show the user, or null when the form may be sent. */
function validateFailure(form: FailureForm): string | null {
  if (!form.failureMode.trim()) return 'Failure mode is required.';
  if (form.date.trim() && !isValidDateInput(form.date)) return 'Date must look like 2025-02-05.';
  if (!isValidNumberInput(form.downtime)) return 'Downtime must be a number.';
  return null;
}

function buildFailurePayload(form: FailureForm, severity: FailureRecord['severity']) {
  return {
    date: toIsoOrNull(form.date) || new Date().toISOString(),
    failureMode: form.failureMode.trim(),
    cause: form.cause.trim(),
    symptoms: splitCsv(form.symptoms),
    severity,
    downtimeHours: toNumberOrNull(form.downtime) ?? 0,
    correctiveAction: form.correctiveAction.trim(),
    notes: form.notes.trim()
  };
}

/** Prefills the edit form from a saved record. */
function toFailureForm(record: FailureRecord): FailureForm {
  return {
    date: toDateInput(record.date),
    failureMode: record.failureMode,
    cause: record.cause || '',
    symptoms: record.symptoms.join(', '),
    downtime: toNumberInput(record.downtimeHours),
    correctiveAction: record.correctiveAction || '',
    notes: record.notes || ''
  };
}

export default function FailureRecordsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<FailureRecord[]>([]);
  const [form, setForm] = useState<FailureForm>(EMPTY_FORM);
  const [severity, setSeverity] = useState<FailureRecord['severity']>('moderate');
  // Only one record is editable at a time; its id decides which card shows the form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FailureForm>(EMPTY_FORM);
  const [editSeverity, setEditSeverity] = useState<FailureRecord['severity']>('moderate');
  const [savingId, setSavingId] = useState<string | null>(null);
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

  const set = (key: keyof FailureForm) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const setEditField = (key: keyof FailureForm) => (value: string) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const invalid = validateFailure(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await api.post('/api/failures', { machine: id, ...buildFailurePayload(form, severity) });
      setForm(EMPTY_FORM);
      setSeverity('moderate');
      setFeedback('Failure record saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (record: FailureRecord) => {
    setError('');
    setFeedback('');
    setEditingId(record._id);
    setEditForm(toFailureForm(record));
    setEditSeverity(record.severity);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const saveEdit = async (record: FailureRecord) => {
    const invalid = validateFailure(editForm);
    if (!invalid && !editForm.date.trim()) {
      // An emptied date would otherwise be rewritten as today, silently moving the
      // record in the MTBF timeline.
      setError('Date is required when correcting a saved record.');
      return;
    }
    if (invalid) {
      setError(invalid);
      return;
    }
    setSavingId(record._id);
    setError('');
    setFeedback('');
    try {
      await api.put(`/api/failures/${record._id}`, buildFailurePayload(editForm, editSeverity));
      setEditingId(null);
      setFeedback('Failure record updated.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId(null);
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
              if (editingId === record._id) setEditingId(null);
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
        <FailureFields form={form} onField={set} severity={severity} onSeverity={(value) => setSeverity(value)} />
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
        records.map((record) => {
          const editing = editingId === record._id;
          return (
            <Card key={record._id} tone={editing ? 'hero' : 'default'}>
              <View style={st.rowHead}>
                <Text style={st.rowTitle}>
                  {fmtDate(record.date)} · {record.failureMode}
                </Text>
                <Badge text={record.severity} tone={severityTone(record.severity)} />
              </View>

              {editing ? (
                <>
                  <SectionHeader
                    title="Correct this record"
                    icon="create-outline"
                    subtitle="Statistics and future-analysis similarity read the corrected values."
                  />
                  <FailureFields
                    form={editForm}
                    onField={setEditField}
                    severity={editSeverity}
                    onSeverity={(value) => setEditSeverity(value)}
                  />
                  <ActionRow>
                    <IconAction icon="close-outline" label="Cancel" onPress={cancelEdit} />
                    <IconAction
                      icon="checkmark-outline"
                      label={savingId === record._id ? 'Saving…' : 'Save changes'}
                      tone="primary"
                      disabled={savingId === record._id}
                      onPress={() => void saveEdit(record)}
                    />
                  </ActionRow>
                </>
              ) : (
                <>
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
                  <ActionRow>
                    <IconAction
                      icon="trash-outline"
                      label="Remove"
                      tone="danger"
                      onPress={() => removeRecord(record)}
                    />
                    <IconAction icon="create-outline" label="Edit" tone="primary" onPress={() => startEdit(record)} />
                  </ActionRow>
                </>
              )}
            </Card>
          );
        })
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
