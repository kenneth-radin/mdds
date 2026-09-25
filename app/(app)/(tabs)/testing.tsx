import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Badge, Button, Card, EmptyState, Field, Muted, Notice, Screen, Subtitle, Title } from '../../../components/ui';
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
      <Title>Testing</Title>
      <Subtitle>Compare the expected maintenance solution with the actual solution. Match score is computed from the real compared text.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {feedback ? <Notice tone="success">{feedback}</Notice> : null}

      {machines.length === 0 ? (
        <EmptyState title="No machines registered yet." message="Register a machine before recording testing cases." />
      ) : (
        <Card>
          <Muted>Machine</Muted>
          {machines.map((machine) => (
            <Pressable key={machine._id} onPress={() => setSelected(machine)}>
              <Card style={{ borderColor: selected?._id === machine._id ? '#4f46e5' : undefined }}>
                <Title>{machine.machineId} · {machine.name}</Title>
                <Muted>{machine.machineType}</Muted>
              </Card>
            </Pressable>
          ))}
          <Field label="Test case description" value={description} onChangeText={setDescription} placeholder="Case 1 - bearing noise on dough mixer" />
          <Field label="Expected maintenance solution" value={expected} onChangeText={setExpected} placeholder="Replace bearing and realign coupling" />
          <Field label="Actual maintenance solution" value={actual} onChangeText={setActual} placeholder="Record the actual action performed" />
          <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Researcher observations" />
          <Button title={busy ? 'Saving…' : 'Save testing case'} onPress={submit} disabled={busy} />
        </Card>
      )}

      {cases.length === 0 ? (
        <EmptyState title="No testing cases recorded yet." />
      ) : (
        cases.map((item) => {
          const machine = typeof item.machine === 'string' ? null : item.machine;
          return (
            <Card key={item._id}>
              <Title>{item.description}</Title>
              <Muted>{machine ? `${machine.machineId} · ${machine.name}` : 'Machine'}</Muted>
              <Muted>Expected: {item.expectedSuggestion}</Muted>
              <Muted>Actual: {item.actualSuggestion}</Muted>
              <Muted>Recorded: {fmtDateTime(item.createdAt)}</Muted>
              <Badge text={item.matched ? `matched ${item.matchScore ?? ''}%` : `not matched ${item.matchScore ?? ''}%`} tone={item.matched ? 'success' : 'warning'} />
            </Card>
          );
        })
      )}
    </Screen>
  );
}
