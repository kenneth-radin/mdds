import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, KeyValue, Loading, Notice, Screen, Subtitle, Title } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { Machine } from '../../../../lib/types';
import { fmtDate, fmtNumber } from '../../../../lib/format';

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [counts, setCounts] = useState({ maintenanceRecords: 0, failureRecords: 0, operationalRecords: 0, cases: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<{ machine: Machine; counts: typeof counts }>(`/api/machines/${id}/summary`);
      setMachine(result.machine);
      setCounts(result.counts);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = () => {
    Alert.alert('Delete machine', 'This removes the machine and all of its records. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/api/machines/${id}`);
            router.replace('/(app)/(tabs)/machines');
          } catch (err) {
            setError(errorMessage(err));
          }
        }
      }
    ]);
  };

  if (loading && !machine) return <Screen><Loading /></Screen>;
  if (!machine) return <Screen><Notice tone="danger">{error || 'Machine not found.'}</Notice></Screen>;

  return (
    <Screen>
      <Title>{machine.machineId} · {machine.name}</Title>
      <Subtitle>{machine.machineType}</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Card>
        <KeyValue label="Manufacturer / model" value={[machine.manufacturer, machine.model].filter(Boolean).join(' ') || '—'} />
        <KeyValue label="Serial number" value={machine.serialNumber || '—'} />
        <KeyValue label="Location" value={machine.location || '—'} />
        <KeyValue label="Criticality" value={machine.criticality} />
        <KeyValue label="Operating hours" value={String(machine.operatingHours)} />
        <KeyValue label="Rated power (kW)" value={fmtNumber(machine.ratedPowerKw)} />
        <KeyValue label="Installed" value={fmtDate(machine.installationDate)} />
        <KeyValue label="Last maintenance" value={fmtDate(machine.lastMaintenanceDate)} />
      </Card>
      <Card>
        <KeyValue label="Maintenance records" value={String(counts.maintenanceRecords)} />
        <KeyValue label="Failure records" value={String(counts.failureRecords)} />
        <KeyValue label="Operational records" value={String(counts.operationalRecords)} />
        <KeyValue label="Maintenance cases" value={String(counts.cases)} />
      </Card>
      <Button title="Maintenance history" onPress={() => router.push(`/(app)/machine/${id}/maintenance`)} />
      <Button title="Failure records" variant="secondary" onPress={() => router.push(`/(app)/machine/${id}/failures`)} />
      <Button title="Operational data" variant="secondary" onPress={() => router.push(`/(app)/machine/${id}/operational`)} />
      <Button title="Start maintenance case" onPress={() => router.push({ pathname: '/(app)/case/new', params: { machine: id } })} />
      <Button title="Delete machine" variant="danger" onPress={remove} />
    </Screen>
  );
}
