import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, EmptyState, Field, Muted, Notice, Screen, Subtitle, Title } from '../../../components/ui';
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
      <Title>New maintenance case</Title>
      <Subtitle>Describe the current problem. The backend will analyze it against real historical records only.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {machines.length === 0 ? (
        <EmptyState title="No machines registered yet." message="Add a machine and its historical records before creating a case." />
      ) : (
        <>
          <Card>
            <Muted>Select machine</Muted>
            {machines.map((machine) => (
              <Pressable key={machine._id} onPress={() => setSelected(machine)}>
                <Card style={{ borderColor: selected?._id === machine._id ? '#4f46e5' : undefined }}>
                  <Title>{selected?._id === machine._id ? '◉' : '○'} {machine.machineId} · {machine.name}</Title>
                  <Muted>{machine.machineType}</Muted>
                </Card>
              </Pressable>
            ))}
          </Card>
          <Card>
            <Field label="Current problem / symptoms *" value={problem} onChangeText={setProblem} placeholder="Machine overheats and makes grinding noise" />
            <Field label="Additional symptom tags (comma separated)" value={symptoms} onChangeText={setSymptoms} placeholder="noise, heat, vibration" />
            <Muted>Urgency</Muted>
            <Pressable onPress={() => setUrgency('low')}><Title>{urgency === 'low' ? '◉' : '○'} Low</Title></Pressable>
            <Pressable onPress={() => setUrgency('medium')}><Title>{urgency === 'medium' ? '◉' : '○'} Medium</Title></Pressable>
            <Pressable onPress={() => setUrgency('high')}><Title>{urgency === 'high' ? '◉' : '○'} High</Title></Pressable>
            <Button title={busy ? 'Analyzing…' : 'ANALYZE CASE'} onPress={submit} disabled={busy} />
          </Card>
        </>
      )}
    </Screen>
  );
}
