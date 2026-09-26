import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, EmptyState, KeyValue, Muted, Notice, Screen, Subtitle, Title } from '../../../components/ui';
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
      <Title>Dashboard</Title>
      <Subtitle>Real records from the maintenance database. Nothing is pre-filled.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading && !report ? <Muted>Loading…</Muted> : null}

      {report && !report.hasData ? (
        <>
          <EmptyState title="No data available yet." message={report.message} />
          <Button title="+ Add Machine" onPress={() => router.push('/(app)/machine/new')} />
        </>
      ) : null}

      {report && report.hasData ? (
        <>
          <Card>
            <KeyValue label="Machines" value={String(report.totals.machines)} />
            <KeyValue label="Maintenance records" value={String(report.totals.maintenanceRecords)} />
            <KeyValue label="Failure records" value={String(report.totals.failureRecords)} />
            <KeyValue label="Operational records" value={String(report.totals.operationalRecords)} />
            <KeyValue label="Maintenance cases" value={String(report.totals.maintenanceCases)} />
            <KeyValue label="Completed cases" value={String(report.totals.completedCases)} />
            <KeyValue label="Testing cases" value={String(report.totals.testingCases)} />
            <KeyValue label="Recorded downtime (h)" value={fmtNumber(report.totals.overallDowntimeHours)} />
          </Card>
          <Button title="+ New maintenance case" onPress={() => router.push('/(app)/case/new')} />
        </>
      ) : null}

      <Card>
        <KeyValue label="ML models" value="Layer 3 benchmark classifiers" />
        <Muted>
          Trained offline on the AI4I 2020 synthetic benchmark dataset — never mixed with this facility&apos;s records.
          Open a card to read its metrics, confusion matrix and stated limitations, or score entered parameters.
        </Muted>
        <Button title="Open ML models" variant="secondary" onPress={() => router.push('/(app)/(tabs)/models')} />
      </Card>
    </Screen>
  );
}
