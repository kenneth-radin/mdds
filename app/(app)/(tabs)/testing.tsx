import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Chip,
  ChoiceGroup,
  EmptyState,
  Field,
  KeyValue,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  theme
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { Machine, TestingCase } from '../../../lib/types';
import { fmtDateTime } from '../../../lib/format';

export default function TestingScreen() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [cases, setCases] = useState<TestingCase[]>([]);
  const [selected, setSelected] = useState<Machine | null>(null);
  const [description, setDescription] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [machineResult, caseResult] = await Promise.all([
        api.get<{ machines: Machine[] }>('/api/machines'),
        api.get<{ cases: TestingCase[] }>('/api/testing/cases')
      ]);
      setMachines(machineResult.machines);
      setCases(caseResult.cases);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const submit = async () => {
    if (!selected) {
      setError('Select the machine this test case belongs to.');
      return;
    }
    if (!description.trim()) {
      setError('Test case description is required.');
      return;
    }
    if (!expected.trim()) {
      setError('Expected maintenance solution is required.');
      return;
    }
    if (!actual.trim()) {
      setError('Actual maintenance solution is required.');
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await api.post('/api/testing/cases', {
        machine: selected._id,
        description,
        expectedSuggestion: expected,
        actualSuggestion: actual,
        notes
      });
      setDescription('');
      setExpected('');
      setActual('');
      setNotes('');
      setFeedback('Testing case saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Testing"
        subtitle="Compare what the system suggests with the maintenance solution actually performed."
        badge={
          cases.length ? <Badge text={`${cases.length} logged`} tone="info" /> : undefined
        }
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

      {machines.length === 0 ? (
        <EmptyState
          icon="construct-outline"
          title="No machines registered yet"
          message="Register a machine before recording testing cases."
        />
      ) : (
        <Card>
          <SectionHeader
            title="New testing case"
            icon="flask-outline"
            subtitle="Record your expectation, then what the workshop actually did."
          />

          <ChoiceGroup
            label="Machine"
            value={selected?._id ?? ''}
            options={machines.map((machine) => ({
              value: machine._id,
              label: `${machine.machineId} · ${machine.name}`,
              hint: machine.machineType
            }))}
            onChange={(id) => setSelected(machines.find((machine) => machine._id === id) ?? null)}
          />

          <Field
            label="Test case description"
            value={description}
            onChangeText={setDescription}
            placeholder="Case 1 – bearing noise on dough mixer"
            required
            multiline
          />
          <Field
            label="Expected maintenance solution"
            value={expected}
            onChangeText={setExpected}
            placeholder="Replace bearing and realign coupling"
            helper="What you expected the system to recommend."
            required
            multiline
          />
          <Field
            label="Actual maintenance solution"
            value={actual}
            onChangeText={setActual}
            placeholder="Record the actual action performed"
            required
            multiline
          />
          <Field
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Researcher observations"
            multiline
          />

          <Button
            title="Save testing case"
            icon="checkmark-outline"
            loading={busy}
            onPress={submit}
          />
        </Card>
      )}

      <SectionHeader
        title="Recorded testing cases"
        icon="list-outline"
        subtitle="Each card shows how closely the suggestion matched what was done."
      />

      {cases.length === 0 ? (
        <EmptyState
          icon="flask-outline"
          title="No testing cases recorded yet"
          message="Save your first case above to start comparing suggestions with reality."
        />
      ) : (
        cases.map((item) => {
          const machine = typeof item.machine === 'string' ? null : item.machine;
          return (
            <Card key={item._id}>
              <View style={st.rowHead}>
                <Text style={st.rowTitle}>{item.description}</Text>
                <Badge
                  text={
                    item.matched
                      ? `match ${item.matchScore ?? 0}%`
                      : `no match (${item.matchScore ?? 0}%)`
                  }
                  tone={item.matched ? 'success' : 'warning'}
                />
              </View>
              <Muted>
                {machine ? `${machine.machineId} · ${machine.name}` : 'Machine'}
              </Muted>
              <KeyValue label="Expected suggestion" value={item.expectedSuggestion} />
              <KeyValue label="Actual suggestion" value={item.actualSuggestion} />
              <View style={st.chipRow}>
                <Chip label={fmtDateTime(item.createdAt)} icon="calendar-outline" />
              </View>
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
