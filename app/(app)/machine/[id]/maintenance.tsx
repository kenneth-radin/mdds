import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

const TYPE_OPTIONS = types.map((item) => ({ value: item, label: item, hint: TYPE_HINTS[item] }));

type MaintenanceForm = {
  date: string;
  problem: string;
  action: string;
  parts: string;
  technician: string;
  downtime: string;
  cost: string;
  loss: string;
};

const EMPTY_FORM: MaintenanceForm = {
  date: '',
  problem: '',
  action: '',
  parts: '',
  technician: '',
  downtime: '',
  cost: '',
  loss: ''
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
function MaintenanceFields({
  form,
  onField,
  type,
  onType
}: {
  form: MaintenanceForm;
  onField: (key: keyof MaintenanceForm) => (value: string) => void;
  type: (typeof types)[number];
  onType: (value: (typeof types)[number]) => void;
}) {
  return (
    <>
      <Field
        label="Date (YYYY-MM-DD)"
        value={form.date}
        onChangeText={onField('date')}
        placeholder="2025-01-20"
        helper="Leave blank to use today's date."
      />
      <ChoiceGroup label="Maintenance type" value={type} options={TYPE_OPTIONS} onChange={onType} />
      <Field
        label="Problem / symptoms"
        value={form.problem}
        onChangeText={onField('problem')}
        placeholder="Abnormal noise and vibration at bearing"
        required
        multiline
      />
      <Field
        label="Action taken"
        value={form.action}
        onChangeText={onField('action')}
        placeholder="Replaced bearing and realigned coupling"
        required
        multiline
      />
      <Field
        label="Parts replaced (comma separated)"
        value={form.parts}
        onChangeText={onField('parts')}
        placeholder="bearing, seal"
      />
      <Field
        label="Technician"
        value={form.technician}
        onChangeText={onField('technician')}
        placeholder="Who performed the work"
      />
      <Field
        label="Downtime (hours)"
        value={form.downtime}
        onChangeText={onField('downtime')}
        keyboardType="numeric"
        placeholder="0"
      />
      <Field label="Cost" value={form.cost} onChangeText={onField('cost')} keyboardType="numeric" placeholder="0" />
      <Field
        label="Production loss (units)"
        value={form.loss}
        onChangeText={onField('loss')}
        keyboardType="numeric"
        placeholder="0"
      />
    </>
  );
}

/** The message to show the user, or null when the form may be sent. */
function validateMaintenance(form: MaintenanceForm): string | null {
  if (!form.problem.trim() || !form.action.trim()) return 'Problem / symptoms and action taken are required.';
  if (form.date.trim() && !isValidDateInput(form.date)) return 'Date must look like 2025-01-20.';
  if (!isValidNumberInput(form.downtime)) return 'Downtime must be a number.';
  if (!isValidNumberInput(form.cost)) return 'Cost must be a number.';
  if (!isValidNumberInput(form.loss)) return 'Production loss must be a number.';
  return null;
}

function buildMaintenancePayload(form: MaintenanceForm, type: (typeof types)[number]) {
  return {
    date: toIsoOrNull(form.date) || new Date().toISOString(),
    maintenanceType: type,
    problem: form.problem.trim(),
    action: form.action.trim(),
    partsReplaced: splitCsv(form.parts),
    technician: form.technician.trim(),
    downtimeHours: toNumberOrNull(form.downtime) ?? 0,
    cost: toNumberOrNull(form.cost),
    productionLossUnits: toNumberOrNull(form.loss)
  };
}

/** Prefills the edit form from a saved record. */
function toMaintenanceForm(record: MaintenanceRecord): MaintenanceForm {
  return {
    date: toDateInput(record.date),
    problem: record.problem,
    action: record.action,
    parts: record.partsReplaced.join(', '),
    technician: record.technician || '',
    downtime: toNumberInput(record.downtimeHours),
    cost: toNumberInput(record.cost),
    loss: toNumberInput(record.productionLossUnits)
  };
}

export default function MaintenanceHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [form, setForm] = useState<MaintenanceForm>(EMPTY_FORM);
  const [type, setType] = useState<(typeof types)[number]>('corrective');
  // Only one record is editable at a time; its id decides which card shows the form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MaintenanceForm>(EMPTY_FORM);
  const [editType, setEditType] = useState<(typeof types)[number]>('corrective');
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

  const set = (key: keyof MaintenanceForm) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const setEditField = (key: keyof MaintenanceForm) => (value: string) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const invalid = validateMaintenance(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await api.post('/api/maintenance', { machine: id, ...buildMaintenancePayload(form, type) });
      setForm(EMPTY_FORM);
      setType('corrective');
      setFeedback('Maintenance record saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (record: MaintenanceRecord) => {
    setError('');
    setFeedback('');
    setEditingId(record._id);
    setEditForm(toMaintenanceForm(record));
    setEditType(record.maintenanceType);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const saveEdit = async (record: MaintenanceRecord) => {
    const invalid = validateMaintenance(editForm);
    if (!invalid && !editForm.date.trim()) {
      // An emptied date would otherwise be rewritten as today, which would move the
      // machine's last-maintenance date and every countdown derived from it.
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
      await api.put(`/api/maintenance/${record._id}`, buildMaintenancePayload(editForm, editType));
      setEditingId(null);
      setFeedback('Maintenance record updated.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const askRemove = (record: MaintenanceRecord) => {
    setError('');
    setFeedback('');
    setPendingRemoveId(record._id);
  };

  const removeRecord = async (record: MaintenanceRecord) => {
    setRemovingId(record._id);
    setError('');
    setFeedback('');
    try {
      await api.del(`/api/maintenance/${record._id}`);
      setPendingRemoveId(null);
      if (editingId === record._id) setEditingId(null);
      setFeedback('Maintenance record removed.');
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
        <MaintenanceFields form={form} onField={set} type={type} onType={(value) => setType(value)} />
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
        records.map((record) => {
          const editing = editingId === record._id;
          return (
            <Card key={record._id} tone={editing ? 'hero' : 'default'}>
              <View style={st.rowHead}>
                <Text style={st.rowTitle}>{fmtDate(record.date)}</Text>
                <Badge text={record.maintenanceType} tone="info" />
              </View>

              {editing ? (
                <>
                  <SectionHeader
                    title="Correct this record"
                    icon="create-outline"
                    subtitle="Analyses and the maintenance countdown read the corrected values."
                  />
                  <MaintenanceFields
                    form={editForm}
                    onField={setEditField}
                    type={editType}
                    onType={(value) => setEditType(value)}
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
                  {pendingRemoveId === record._id ? (
                    <>
                      <Notice tone="danger" title="Remove maintenance record?">
                        Delete the {fmtDate(record.date)} {record.maintenanceType} record? Future analyses will no
                        longer see it. This cannot be undone.
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
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    marginTop: theme.space.sm
  }
});
