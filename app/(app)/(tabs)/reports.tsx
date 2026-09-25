import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Button, Card, EmptyState, KeyValue, Notice, Screen, Subtitle, Title } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { SummaryReport } from '../../../lib/types';
import { fmtNumber } from '../../../lib/format';

function rowsFromReport(report: SummaryReport): string {
  const lines = [
    'Metric,Value',
    `Machines,${report.totals.machines}`,
    `Maintenance records,${report.totals.maintenanceRecords}`,
    `Failure records,${report.totals.failureRecords}`,
    `Operational records,${report.totals.operationalRecords}`,
    `Maintenance cases,${report.totals.maintenanceCases}`,
    `Completed cases,${report.totals.completedCases}`,
    `Testing cases,${report.totals.testingCases}`,
    `Overall downtime hours,${report.totals.overallDowntimeHours}`
  ];
  return lines.join('\n');
}

export default function ReportsScreen() {
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setReport(await api.get<SummaryReport>('/api/reports/summary'));
        } catch (err) {
          setError(errorMessage(err));
        }
      })();
    }, [])
  );

  const share = async (format: 'json' | 'csv') => {
    if (!report) return;
    try {
      const content = format === 'json' ? JSON.stringify(report, null, 2) : rowsFromReport(report);
      const file = new File(Paths.cache, `mdss-summary-report.${format}`);
      file.create({ overwrite: true });
      file.write(content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: format === 'json' ? 'application/json' : 'text/csv',
          dialogTitle: 'Share summary report'
        });
      } else {
        setError('Sharing is not available on this device.');
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Screen>
      <Title>Reports</Title>
      <Subtitle>All values below are aggregated from actual database records.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!report ? <EmptyState title="No report data loaded yet." /> : null}
      {report && !report.hasData ? <EmptyState title="No data available yet." message={report.message} /> : null}
      {report && report.hasData ? (
        <>
          <Card>
            <KeyValue label="Machines" value={String(report.totals.machines)} />
            <KeyValue label="Maintenance records" value={String(report.totals.maintenanceRecords)} />
            <KeyValue label="Failure records" value={String(report.totals.failureRecords)} />
            <KeyValue label="Operational records" value={String(report.totals.operationalRecords)} />
            <KeyValue label="Maintenance cases" value={String(report.totals.maintenanceCases)} />
            <KeyValue label="Completed cases" value={String(report.totals.completedCases)} />
            <KeyValue label="Overall downtime (h)" value={fmtNumber(report.totals.overallDowntimeHours)} />
            <KeyValue label="Testing match rate" value={report.testing.matchRate === null ? '—' : `${report.testing.matchRate}%`} />
          </Card>
          <Button title="Share JSON report" onPress={() => share('json')} />
          <Button title="Share CSV report" variant="secondary" onPress={() => share('csv')} />
        </>
      ) : null}
    </Screen>
  );
}
