import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActionRow,
  Badge,
  Button,
  Card,
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
import { OperationalRecord } from '../../../../lib/types';
import { fmtDate, fmtNumber, isValidDateInput, isValidNumberInput, toIsoOrNull, toNumberOrNull } from '../../../../lib/format';

type OperationalForm = {
  date: string;
  operatingHours: string;
  productionOutput: string;
  downtime: string;
  energy: string;
  notes: string;
};

const EMPTY_FORM: OperationalForm = {
  date: '',
  operatingHours: '',
  productionOutput: '',
  downtime: '',
  energy: '',
  notes: ''
};

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
function OperationalFields({
  form,
  onField
}: {
  form: OperationalForm;
  onField: (key: keyof OperationalForm) => (value: string) => void;
}) {
  return (
    <>
      <Field
        label="Date (YYYY-MM-DD)"
        value={form.date}
        onChangeText={onField('date')}
        placeholder="2025-03-10"
        helper="Leave blank to use today's date."
      />
      <Field
        label="Operating hours"
        value={form.operatingHours}
        onChangeText={onField('operatingHours')}
        keyboardType="numeric"
        placeholder="0"
      />
      <Field
        label="Production output"
        value={form.productionOutput}
        onChangeText={onField('productionOutput')}
        keyboardType="numeric"
        placeholder="0"
      />
      <Field
        label="Downtime (hours)"
        value={form.downtime}
        onChangeText={onField('downtime')}
        keyboardType="numeric"
        placeholder="0"
      />
      <Field
        label="Energy (kWh)"
        value={form.energy}
        onChangeText={onField('energy')}
        keyboardType="numeric"
        placeholder="0"
      />
      <Field label="Notes" value={form.notes} onChangeText={onField('notes')} placeholder="Optional" multiline />
    </>
  );
}

/** The message to show the user, or null when the form may be sent. */
function validateOperational(form: OperationalForm): string | null {
  if (form.date.trim() && !isValidDateInput(form.date)) return 'Date must look like 2025-03-10.';
  if (!isValidNumberInput(form.operatingHours)) return 'Operating hours must be a number.';
  if (!isValidNumberInput(form.productionOutput)) return 'Production output must be a number.';
  if (!isValidNumberInput(form.downtime)) return 'Downtime must be a number.';
  if (!isValidNumberInput(form.energy)) return 'Energy must be a number.';
  return null;
}

function buildOperationalPayload(form: OperationalForm) {
  return {
    date: toIsoOrNull(form.date) || new Date().toISOString(),
    operatingHours: toNumberOrNull(form.operatingHours) ?? 0,
    productionOutput: toNumberOrNull(form.productionOutput),
    downtimeHours: toNumberOrNull(form.downtime) ?? 0,
    energyKwh: toNumberOrNull(form.energy),
    notes: form.notes.trim()
  };
}

/** Prefills the edit form from a saved record. */
function toOperationalForm(record: OperationalRecord): OperationalForm {
  return {
    date: toDateInput(record.date),
    operatingHours: toNumberInput(record.operatingHours),
    productionOutput: toNumberInput(record.productionOutput),
    downtime: toNumberInput(record.downtimeHours),
    energy: toNumberInput(record.energyKwh),
    notes: record.notes || ''
  };
}

export default function OperationalDataScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<OperationalRecord[]>([]);
  const [form, setForm] = useState<OperationalForm>(EMPTY_FORM);
  // Only one record is editable at a time; its id decides which card shows the form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OperationalForm>(EMPTY_FORM);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Removal is confirmed inline: the native Alert dialog this screen used to
  // open never renders on some devices, which made the Remove button look dead.
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
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

  const set = (key: keyof OperationalForm) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const setEditField = (key: keyof OperationalForm) => (value: string) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const invalid = validateOperational(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await api.post('/api/operational-data', { machine: id, ...buildOperationalPayload(form) });
      setForm(EMPTY_FORM);
      setFeedback('Operational data saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (record: OperationalRecord) => {
    setError('');
    setFeedback('');
    setEditingId(record._id);
    setEditForm(toOperationalForm(record));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const saveEdit = async (record: OperationalRecord) => {
    const invalid = validateOperational(editForm);
    if (!invalid && !editForm.date.trim()) {
      // An emptied date would be rewritten as today, putting this reading at the end
      // of the series and making it the newest operating-hours figure.
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
      await api.put(`/api/operational-data/${record._id}`, buildOperationalPayload(editForm));
      setEditingId(null);
      setFeedback('Operational record updated.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const askRemove = (record: OperationalRecord) => {
    setError('');
    setFeedback('');
    setPendingRemoveId(record._id);
  };

  const removeRecord = async (record: OperationalRecord) => {
    setRemovingId(record._id);
    setError('');
    setFeedback('');
    try {
      await api.del(`/api/operational-data/${record._id}`);
      setPendingRemoveId(null);
      if (editingId === record._id) setEditingId(null);
      setFeedback('Operational record removed.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRemovingId(null);
    }
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
        <OperationalFields form={form} onField={set} />
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
        records.map((record) => {
          const editing = editingId === record._id;
          return (
            <Card key={record._id} tone={editing ? 'hero' : 'default'}>
              <View style={st.rowHead}>
                <Text style={st.rowTitle}>{fmtDate(record.date)}</Text>
                <Badge text="operational" tone="info" />
              </View>

              {editing ? (
                <>
                  <SectionHeader
                    title="Correct this reading"
                    icon="create-outline"
                    subtitle="History statistics are recalculated from the corrected values."
                  />
                  <OperationalFields form={editForm} onField={setEditField} />
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
                  {pendingRemoveId === record._id ? (
                    <>
                      <Notice tone="danger" title="Remove operational record?">
                        Delete the operational reading for {fmtDate(record.date)}? History statistics will be
                        recalculated without it. This cannot be undone.
                      </Notice>
                      <ActionRow>
                        <IconAction icon="close-outline" label="Cancel" onPress={() => setPendingRemoveId(null)} />
                        <IconAction
                          icon="checkmark-outline"
                          label={removingId === record._id ? 'Removing…' : 'Confirm remove'}
                          tone="danger"
                          disabled={removingId === record._id}
                          onPress={() => void removeRecord(record)}
                        />
                      </ActionRow>
                    </>
                  ) : (
                    <ActionRow>
                      <IconAction icon="trash-outline" label="Remove" tone="danger" onPress={() => askRemove(record)} />
                      <IconAction icon="create-outline" label="Edit" tone="primary" onPress={() => startEdit(record)} />
                    </ActionRow>
                  )}
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
  }
});
