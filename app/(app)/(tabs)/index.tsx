import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Button,
  ButtonGroup,
  Card,
  Collapse,
  EmptyState,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatCard,
  theme
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { SummaryReport } from '../../../lib/types';
import { fmtNumber } from '../../../lib/format';

export default function DashboardScreen() {
  const router = useRouter();
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await api.get<SummaryReport>('/api/reports/summary'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <ScreenHeader
        title="Dashboard"
        subtitle="Live counts from the maintenance database — nothing is pre-filled."
      />

      {error ? (
        <Notice tone="danger" title="Could not load the dashboard">
          {error}
        </Notice>
      ) : null}

      {loading && !report ? (
        <Loading label="Loading dashboard…" caption="Counting machines, records and cases." />
      ) : null}

      {report && !report.hasData ? (
        <EmptyState
          icon="construct-outline"
          title="No data yet"
          message={report.message}
          action={{ title: 'Add a machine', onPress: () => router.push('/(app)/machine/new') }}
        />
      ) : null}

      {report && report.hasData ? (
        <>
          <View style={st.statRow}>
            <StatCard
              label="Machines"
              value={String(report.totals.machines)}
              hint="registered assets"
              icon="construct-outline"
              tone="primary"
            />
            <StatCard
              label="Maintenance"
              value={String(report.totals.maintenanceRecords)}
              hint="recorded jobs"
              icon="build-outline"
            />
          </View>

          <View style={st.statRow}>
            <StatCard
              label="Failures"
              value={String(report.totals.failureRecords)}
              hint="reported breakdowns"
              icon="warning-outline"
            />
            <StatCard
              label="Cases"
              value={String(report.totals.maintenanceCases)}
              hint={`${report.totals.completedCases} completed`}
              icon="clipboard-outline"
            />
          </View>

          <View style={st.statRow}>
            <StatCard
              label="Testing cases"
              value={String(report.totals.testingCases)}
              hint="benchmark scenarios"
              icon="flask-outline"
            />
            <StatCard
              label="Downtime"
              value={`${fmtNumber(report.totals.overallDowntimeHours)} h`}
              hint="total recorded"
              icon="time-outline"
            />
          </View>

          <Card tone="muted">
            <Collapse title="All record counts" subtitle="Every table the dashboard reads from">
              <KeyValue label="Machines" value={String(report.totals.machines)} />
              <KeyValue
                label="Maintenance records"
                value={String(report.totals.maintenanceRecords)}
              />
              <KeyValue label="Failure records" value={String(report.totals.failureRecords)} />
              <KeyValue
                label="Operational records"
                value={String(report.totals.operationalRecords)}
              />
              <KeyValue
                label="Maintenance cases"
                value={String(report.totals.maintenanceCases)}
              />
              <KeyValue label="Completed cases" value={String(report.totals.completedCases)} />
              <KeyValue label="Testing cases" value={String(report.totals.testingCases)} />
              <KeyValue
                label="Recorded downtime (h)"
                value={fmtNumber(report.totals.overallDowntimeHours)}
              />
            </Collapse>
          </Card>

          <ButtonGroup>
            <Button
              title="New maintenance case"
              icon="add-outline"
              onPress={() => router.push('/(app)/case/new')}
            />
            <Button
              title="Register a machine"
              variant="secondary"
              icon="construct-outline"
              onPress={() => router.push('/(app)/machine/new')}
            />
          </ButtonGroup>
        </>
      ) : null}

      <Card tone="muted">
        <SectionHeader
          title="AI failure prediction"
          icon="hardware-chip-outline"
          subtitle="Layer 3 benchmark classifiers"
        />
        <Muted>
          Trained offline on the AI4I 2020 synthetic benchmark dataset — never mixed with this facility's records.
          Open a model card to read its metrics, confusion matrix and stated limitations, or score entered operating
          parameters.
        </Muted>
        <Button
          title="Open AI predictions"
          variant="secondary"
          icon="sparkles-outline"
          onPress={() => router.push('/(app)/(tabs)/models')}
        />
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    gap: theme.space.md
  }
});
