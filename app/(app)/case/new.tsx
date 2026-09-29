import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Card,
  ChoiceGroup,
  EmptyState,
  Field,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { Machine, MaintenanceCase } from '../../../lib/types';
import { splitCsv } from '../../../lib/format';

export default function NewCaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ machine?: string }>();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selected, setSelected] = useState<Machine | null>(null);
  const [problem, setProblem] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const result = await api.get<{ machines: Machine[] }>('/api/machines');
          setMachines(result.machines);
          if (params.machine) {
            setSelected(result.machines.find((m) => m._id === params.machine || m.machineId === params.machine) || null);
          }
        } catch (err) {
          setError(errorMessage(err));
        }
      })();
    }, [params.machine])
  );

  const submit = async () => {
    if (!selected) {
      setError('Select the machine that has the current problem.');
      return;
    }
    if (problem.trim().length < 3) {
      setError('Describe the current problem in at least 3 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.post<{ maintenanceCase: MaintenanceCase }>('/api/analysis/maintenance-case', {
        machine: selected._id,
        currentProblem: problem.trim(),
        symptoms: splitCsv(symptoms),
        urgency
      });
      router.replace(`/(app)/case/${result.maintenanceCase._id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="New maintenance case"
        subtitle="Describe the current problem. The analyser only compares it with real historical records."
      />

      {error ? (
        <Notice tone="danger" title="Could not create the case">
          {error}
        </Notice>
      ) : null}

      {machines.length === 0 ? (
        <EmptyState
          icon="construct-outline"
          title="No machines registered yet"
          message="Add a machine and its historical records before creating a case."
          action={{ title: 'Add a machine', onPress: () => router.push('/(app)/machine/new') }}
        />
      ) : (
        <>
          <Card>
            <SectionHeader
              title="Case details"
              icon="clipboard-outline"
              subtitle="What happened, and how urgent it is"
            />

            <Field
              label="Current problem / symptoms"
              value={problem}
              onChangeText={setProblem}
              placeholder="Machine overheats and makes grinding noise"
              helper="Write it the way a technician would describe it — matching wording drives the retrieval."
              required
              multiline
            />

            <Field
              label="Additional symptom tags (comma separated)"
              value={symptoms}
              onChangeText={setSymptoms}
              placeholder="noise, heat, vibration"
              helper="Short tags are matched as separate keywords."
            />

            <ChoiceGroup
              label="Urgency"
              value={urgency}
              options={[
                { value: 'low', label: 'Low', hint: 'Machine still runs, monitor it' },
                { value: 'medium', label: 'Medium', hint: 'Plan maintenance soon' },
                { value: 'high', label: 'High', hint: 'Stop and inspect now' }
              ]}
              onChange={(value) => setUrgency(value)}
            />
          </Card>

          <Card tone="muted">
            <SectionHeader
              title="Machine"
              icon="construct-outline"
              subtitle="Which asset has the problem"
            />
            <ChoiceGroup
              value={selected?._id ?? ''}
              options={machines.map((machine) => ({
                value: machine._id,
                label: `${machine.machineId} · ${machine.name}`,
                hint: machine.machineType
              }))}
              onChange={(id) => setSelected(machines.find((machine) => machine._id === id) ?? null)}
            />
            <Muted>
              The analysis compares this case with the maintenance jobs, failure reports and completed cases already
              recorded for the machine you pick.
            </Muted>
          </Card>

          <Button title="Analyse case" icon="sparkles-outline" loading={busy} onPress={submit} />
        </>
      )}
    </Screen>
  );
}
