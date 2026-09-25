import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Input, Muted, Notice, Screen, Subtitle, Title } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { Machine } from '../../../lib/types';
import { fmtDate } from '../../../lib/format';

function tone(criticality: Machine['criticality']): 'info' | 'warning' | 'danger' {
  if (criticality === 'high') return 'danger';
  if (criticality === 'medium') return 'warning';
  return 'info';
}

export default function MachinesScreen() {
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const result = await api.get<{ machines: Machine[] }>(`/api/machines${query}`);
      setMachines(result.machines);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <Title>Machines</Title>
      <Subtitle>Only machines stored in the database are listed.</Subtitle>
      <Input value={search} onChangeText={setSearch} placeholder="Search machine ID, name, type, location" />
      <Button title="+ Add Machine" onPress={() => router.push('/(app)/machine/new')} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading && machines.length === 0 ? <Muted>Loading…</Muted> : null}
      {!loading && machines.length === 0 ? (
        <EmptyState title="No machines registered yet." message="Add a machine to begin recording historical maintenance data." />
      ) : null}
      {machines.map((machine) => (
        <Pressable key={machine._id} onPress={() => router.push(`/(app)/machine/${machine._id}`)}>
          <Card>
            <Title>{machine.machineId} · {machine.name}</Title>
            <Muted>{machine.machineType} · {machine.location || 'Location not set'}</Muted>
            <Muted>Operating hours: {machine.operatingHours} · Last maintenance: {fmtDate(machine.lastMaintenanceDate)}</Muted>
            <Badge text={machine.criticality} tone={tone(machine.criticality)} />
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
