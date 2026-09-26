import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Muted, Notice, Screen, Subtitle, Title } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { MaintenanceCase } from '../../../lib/types';
import { fmtDateTime, humanize } from '../../../lib/format';

function tone(status: MaintenanceCase['status']): 'info' | 'warning' | 'danger' | 'success' {
  if (status === 'completed') return 'success';
  if (status === 'reviewed') return 'info';
  if (status === 'analyzed') return 'warning';
  return 'danger';
}

export default function CasesScreen() {
  const router = useRouter();
  const [cases, setCases] = useState<MaintenanceCase[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setError('');
        try {
          const result = await api.get<{ cases: MaintenanceCase[] }>('/api/maintenance-cases');
          setCases(result.cases);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  return (
    <Screen>
      <Title>Maintenance cases</Title>
      <Subtitle>Current problems analyzed against real historical records.</Subtitle>
      <Button title="+ Create maintenance case" onPress={() => router.push('/(app)/case/new')} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading && cases.length === 0 ? <Muted>Loading…</Muted> : null}
      {!loading && cases.length === 0 ? (
        <EmptyState title="No maintenance cases recorded yet." message="Create a case to run an analysis against this machine's history." />
      ) : null}
      {cases.map((item) => {
        const machine = typeof item.machine === 'string' ? null : item.machine;
        return (
          <Pressable key={item._id} onPress={() => router.push(`/(app)/case/${item._id}`)}>
            <Card>
              <Title>{item.caseNumber}</Title>
              <Muted>{machine ? `${machine.machineId} · ${machine.name}` : 'Machine'}</Muted>
              <Muted>{item.currentProblem}</Muted>
              <Muted>Reported: {fmtDateTime(item.dateReported)}</Muted>
              <Badge text={humanize(item.status)} tone={tone(item.status)} />
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
