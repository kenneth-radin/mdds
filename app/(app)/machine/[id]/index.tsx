import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { machineStateApi, type MachineState } from '../../../../lib/api/machineState';
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
  const [currentState, setCurrentState] = useState<{ state: MachineState; changedAt: number; changedBy: string | null; ageMs: number } | null>(null);
  const [settingState, setSettingState] = useState(false);
  // Two-step delete confirmation rendered inline. The previous flow opened a
  // native Alert dialog, which some devices silently drop — the button then
  // looked dead. An on-screen confirmation always reacts to the first tap.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSettingState(true);
    setError('');
    try {
      const [machineResult, stateResult] = await Promise.all([
        api.get<{ machine: Machine; counts: typeof counts }>(`/api/machines/${id}/summary`),
        machineStateApi.getCurrent(id)
      ]);
      setMachine(machineResult.machine);
      setCounts(machineResult.counts);
      setCurrentState(stateResult.current);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setSettingState(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const stateTone = (state: MachineState | null | undefined) => {
    switch (state) {
      case 'starting': return 'warning' as const;
      case 'operating': return 'success' as const;
      case 'stopped': return 'danger' as const;
      default: return 'info' as const;
    }
  };

  const stateLabel = (state: MachineState | null | undefined) => {
    switch (state) {
      case 'starting': return '🟡 Starting';
      case 'operating': return '🟢 Operating';
      case 'stopped': return '⚫ Stopped';
      default: return '—';
    }
  };

  const setState = async (state: MachineState) => {
    setSettingState(true);
    setError('');
    try {
      await machineStateApi.setState(id, state);
      const result = await machineStateApi.getCurrent(id);
      setCurrentState(result.current);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSettingState(false);
    }
  };

  const askDelete = () => {
    setError('');
    setConfirmingDelete(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.del(`/api/machines/${id}`);
      router.replace('/(app)/(tabs)/machines');
    } catch (err) {
      setError(errorMessage(err));
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
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

      {/* Machine state — prominent live status badge */}
      <View style={st.stateRow}>
        <Text style={st.stateLabel}>Machine state</Text>
        <Badge text={stateLabel(currentState?.state)} tone={stateTone(currentState?.state)} />
      </View>

      {/* Reminder banner: non-blocking nudge when stuck in Starting > 10 min */}
      {currentState?.state === 'starting' && currentState.ageMs > 600000 && (
        <Notice tone="warning" title="Machine has been in Starting state for 10+ minutes">
          Update status to Operating if it is running stable now.
        </Notice>
      )}

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
          <Divider />
          <KeyValue label="Ice shape" value={machine.iceShape || '—'} />
          <KeyValue label="Control" value={machine.control || '—'} />
          <KeyValue
            label="Power"
            value={machine.powerW === null || machine.powerW === undefined ? '—' : `${machine.powerW} W`}
          />
          <KeyValue label="Structure" value={machine.structure || '—'} />
          <KeyValue label="Material" value={machine.material || '—'} />
          <KeyValue label="Application" value={machine.application || '—'} />
          <KeyValue label="Condensing mode" value={machine.condensingMode || '—'} />
          <KeyValue
            label="Filtering device"
            value={machine.filteringDevice === undefined || machine.filteringDevice === null ? '—' : machine.filteringDevice ? 'Yes' : 'No'}
          />
          <KeyValue
            label="Automatic cleaning"
            value={machine.autoCleaningDevice === undefined || machine.autoCleaningDevice === null ? '—' : machine.autoCleaningDevice ? 'Yes' : 'No'}
          />
          <KeyValue
            label="Net / gross weight"
            value={
              machine.netWeightKg === null || machine.netWeightKg === undefined
                ? '—'
                : `${machine.netWeightKg} kg / ${machine.grossWeightKg ?? '—'} kg`
            }
          />
          <KeyValue label="Specification" value={machine.specification || '—'} />
          <KeyValue label="Trademark" value={machine.trademark || '—'} />
          <KeyValue label="Origin" value={machine.origin || '—'} />
          {machine.notes ? (
            <>
              <Divider />
              <KeyValue label="Notes" value={machine.notes} />
            </>
          ) : null}
        </Collapse>
      </Card>

      {/* Personnel state flagging — 3-button segmented control */}
      <SectionHeader title="Machine state" icon="checkbox-outline" subtitle="Personnel taps to flag the current machine state." />
      <View style={st.segmentedRow}>
        <Button
          title="🟡 Starting"
          variant={currentState?.state === 'starting' ? 'primary' : 'secondary'}
          onPress={() => setState('starting')}
          disabled={settingState}
        />
        <Button
          title="🟢 Operating"
          variant={currentState?.state === 'operating' ? 'primary' : 'secondary'}
          onPress={() => setState('operating')}
          disabled={settingState}
        />
        <Button
          title="⚫ Stopped"
          variant={currentState?.state === 'stopped' ? 'primary' : 'secondary'}
          onPress={() => setState('stopped')}
          disabled={settingState}
        />
      </View>

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

      {confirmingDelete ? (
        <Notice tone="danger" title="Delete this machine?">
          This permanently removes the machine and all of its maintenance, failure and operational records. Press
          "Confirm delete" to go ahead, or Cancel to keep it.
        </Notice>
      ) : null}
      {confirmingDelete ? (
        <View style={st.deleteRow}>
          <Button
            title="Cancel"
            variant="outline"
            style={{ flex: 1, marginRight: theme.space.sm }}
            onPress={() => setConfirmingDelete(false)}
          />
          <Button
            title="Confirm delete"
            variant="danger"
            icon="trash-outline"
            loading={deleting}
            style={{ flex: 1 }}
            onPress={confirmDelete}
          />
        </View>
      ) : (
        <Button title="Delete machine" variant="danger" icon="trash-outline" onPress={askDelete} />
      )}
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
  },
  deleteRow: {
    flexDirection: 'row',
    marginTop: theme.space.sm
  },
  // Machine state status row (prominent live badge)
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.space.sm,
    marginBottom: theme.space.sm
  },
  stateLabel: {
    ...theme.font.captionMedium,
    color: theme.textSecondary
  },
  // Segmented control: 3 state buttons side by side
  segmentedRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.sm
  }
});
