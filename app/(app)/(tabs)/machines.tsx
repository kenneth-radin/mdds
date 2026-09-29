import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Input,
  Loading,
  Muted,
  Notice,
  PressableCard,
  Screen,
  ScreenHeader,
  SectionHeader,
  theme
} from '../../../components/ui';
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
      <ScreenHeader
        title="Machines"
        subtitle="Only machines stored in the database are listed."
        badge={
          machines.length ? (
            <Badge
              text={`${machines.length} ${machines.length === 1 ? 'machine' : 'machines'}`}
              tone="info"
            />
          ) : undefined
        }
      />

      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search machine ID, name, type, location"
      />
      <Button title="Add machine" icon="add-outline" onPress={() => router.push('/(app)/machine/new')} />

      {error ? (
        <Notice tone="danger" title="Could not load machines">
          {error}
        </Notice>
      ) : null}

      {loading && machines.length === 0 ? <Loading label="Loading machines…" /> : null}

      {!loading && machines.length === 0 ? (
        <EmptyState
          icon="construct-outline"
          title={search.trim() ? 'No machine matches that search' : 'No machines registered yet'}
          message={
            search.trim()
              ? 'Try a shorter search term, or clear the search box to list every machine.'
              : 'Add a machine to begin recording historical maintenance data.'
          }
          action={
            search.trim()
              ? undefined
              : { title: 'Add machine', onPress: () => router.push('/(app)/machine/new') }
          }
        />
      ) : null}

      {machines.length ? (
        <SectionHeader
          title="Machine list"
          icon="list-outline"
          subtitle="Tap a machine to open its history, cases and AI analysis."
        />
      ) : null}

      {machines.map((machine) => (
        <PressableCard key={machine._id} onPress={() => router.push(`/(app)/machine/${machine._id}`)}>
          <View style={st.rowHead}>
            <Text style={st.rowTitle}>
              {machine.machineId} · {machine.name}
            </Text>
            <Badge text={machine.criticality} tone={tone(machine.criticality)} />
          </View>
          <Muted>
            {machine.machineType} · {machine.location || 'Location not set'}
          </Muted>
          <View style={st.chipRow}>
            <Chip label={`${machine.operatingHours} h`} icon="speedometer-outline" />
            <Chip label={`last service ${fmtDate(machine.lastMaintenanceDate)}`} icon="time-outline" />
          </View>
        </PressableCard>
      ))}
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
