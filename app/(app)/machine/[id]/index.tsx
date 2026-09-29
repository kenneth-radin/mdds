import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  Collapse,
  Divider,
  EmptyState,
  KeyValue,
  Loading,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatCard,
  theme
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { Machine } from '../../../../lib/types';
import { fmtDate, fmtNumber } from '../../../../lib/format';

function criticalityTone(criticality: Machine['criticality']) {
  if (criticality === 'high') return 'danger' as const;
  if (criticality === 'medium') return 'warning' as const;
  return 'info' as const;
}

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

  if (loading && !machine) {
    return (
      <Screen>
        <Loading label="Loading machine…" caption="Fetching the asset details and its record counts." />
      </Screen>
    );
  }

  if (!machine) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Machine unavailable"
          message={error || 'This machine could not be found. It may have been deleted.'}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={`${machine.machineId} · ${machine.name}`}
        subtitle={`${machine.machineType} · ${machine.location || 'Location not set'}`}
        badge={<Badge text={machine.criticality} tone={criticalityTone(machine.criticality)} />}
      />

      {error ? (
        <Notice tone="danger" title="Something went wrong">
          {error}
        </Notice>
      ) : null}

      <View style={st.statRow}>
        <StatCard
          label="Maintenance"
          value={String(counts.maintenanceRecords)}
          hint="recorded jobs"
          icon="build-outline"
          tone="primary"
        />
        <StatCard
          label="Failures"
          value={String(counts.failureRecords)}
          hint="reported breakdowns"
          icon="warning-outline"
        />
      </View>

      <View style={st.statRow}>
        <StatCard
          label="Operational"
          value={String(counts.operationalRecords)}
          hint="sensor readings"
          icon="pulse-outline"
        />
        <StatCard
          label="Cases"
          value={String(counts.cases)}
          hint="analysed problems"
          icon="clipboard-outline"
        />
      </View>

      <Card>
        <SectionHeader title="Asset details" icon="construct-outline" />
        <KeyValue label="Operating hours" value={String(machine.operatingHours)} />
        <KeyValue label="Last maintenance" value={fmtDate(machine.lastMaintenanceDate)} />
        <KeyValue label="Installed" value={fmtDate(machine.installationDate)} />
        <Collapse title="Specification" subtitle="Manufacturer, serial number and rated values">
          <KeyValue
            label="Manufacturer / model"
            value={[machine.manufacturer, machine.model].filter(Boolean).join(' ') || '—'}
          />
          <KeyValue label="Serial number" value={machine.serialNumber || '—'} />
          <KeyValue label="Location" value={machine.location || '—'} />
          <KeyValue label="Criticality" value={machine.criticality} />
          <KeyValue label="Rated power (kW)" value={fmtNumber(machine.ratedPowerKw)} />
          <KeyValue label="Rated voltage (V)" value={fmtNumber(machine.ratedVoltage)} />
          <KeyValue label="Rated current (A)" value={fmtNumber(machine.ratedCurrent)} />
          <KeyValue label="Design speed (rpm)" value={fmtNumber(machine.designSpeedRpm)} />
          <KeyValue
            label="Rated capacity"
            value={
              machine.ratedCapacity === null
                ? '—'
                : `${fmtNumber(machine.ratedCapacity)} ${machine.capacityUnit || ''}`.trim()
            }
          />
          <KeyValue label="Year acquired" value={machine.yearAcquired === null ? '—' : String(machine.yearAcquired)} />
          <KeyValue
            label="Recommended interval"
            value={
              machine.recommendedMaintenanceIntervalDays === null
                ? '—'
                : `${machine.recommendedMaintenanceIntervalDays} days`
            }
          />
          {machine.notes ? (
            <>
              <Divider />
              <KeyValue label="Notes" value={machine.notes} />
            </>
          ) : null}
        </Collapse>
      </Card>

      <SectionHeader
        title="History & analysis"
        icon="search-outline"
        subtitle="Add records so future analyses have evidence to work with."
      />
      <ButtonGroup>
        <Button
          title="Maintenance history"
          icon="build-outline"
          onPress={() => router.push(`/(app)/machine/${id}/maintenance`)}
        />
        <Button
          title="Failure records"
          variant="secondary"
          icon="warning-outline"
          onPress={() => router.push(`/(app)/machine/${id}/failures`)}
        />
        <Button
          title="Operational data"
          variant="secondary"
          icon="pulse-outline"
          onPress={() => router.push(`/(app)/machine/${id}/operational`)}
        />
        <Button
          title="Start maintenance case"
          icon="sparkles-outline"
          onPress={() => router.push({ pathname: '/(app)/case/new', params: { machine: id } })}
        />
      </ButtonGroup>

      <Button title="Delete machine" variant="danger" icon="trash-outline" onPress={remove} />
    </Screen>
  );
}

const st = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    // Same reflow rule as the other screens: narrow phones get 2+1 instead
    // of three crushed columns.
    flexWrap: 'wrap',
    gap: theme.space.md
  }
});
