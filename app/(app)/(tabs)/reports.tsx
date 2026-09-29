import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Button,
  ButtonGroup,
  Card,
  Collapse,
  EmptyState,
  KeyValue,
  Loading,
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
    `Overall downtime hours,${report.totals.overallDowntimeHours}`,
    `Suggestions accepted,${report.suggestionDecisions.accepted}`,
    `Suggestions modified,${report.suggestionDecisions.modified}`,
    `Suggestions rejected,${report.suggestionDecisions.rejected}`,
    `Suggestions not reviewed,${report.suggestionDecisions.notReviewed}`
  ];
  return lines.join('\n');
}

export default function ReportsScreen() {
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setError('');
        try {
          setReport(await api.get<SummaryReport>('/api/reports/summary'));
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setLoading(false);
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
      <ScreenHeader
        title="Reports"
        subtitle="Every number below is aggregated from actual database records."
      />

      {error ? (
        <Notice tone="danger" title="Could not build the report">
          {error}
        </Notice>
      ) : null}

      {loading && !report ? (
        <Loading label="Building the summary…" caption="Aggregating records, cases and testing matches." />
      ) : null}

      {!loading && !report ? (
        <EmptyState
          icon="document-text-outline"
          title="No report data loaded"
          message="Pull to reopen this tab, or check the backend connection in Settings."
        />
      ) : null}

      {report && !report.hasData ? (
        <EmptyState icon="document-text-outline" title="No data yet" message={report.message} />
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
              label="Downtime"
              value={`${fmtNumber(report.totals.overallDowntimeHours)} h`}
              hint="total recorded"
              icon="time-outline"
            />
          </View>

          <View style={st.statRow}>
            <StatCard
              label="Cases"
              value={String(report.totals.maintenanceCases)}
              hint={`${report.totals.completedCases} completed`}
              icon="clipboard-outline"
            />
            <StatCard
              label="Testing match rate"
              value={report.testing.matchRate === null ? '—' : `${report.testing.matchRate}%`}
              hint="suggestion vs actual"
              icon="flask-outline"
            />
          </View>

          <SectionHeader
            title="Human response to suggestions"
            icon="git-compare-outline"
            subtitle="What people actually did with the suggestions this system produced."
          />
          <View style={st.statRow}>
            <StatCard
              label="Accepted"
              value={String(report.suggestionDecisions.accepted)}
              hint="used as suggested"
              icon="checkmark-done-outline"
              tone="primary"
            />
            <StatCard
              label="Modified"
              value={String(report.suggestionDecisions.modified)}
              hint="adjusted first"
              icon="create-outline"
            />
          </View>
          <View style={st.statRow}>
            <StatCard
              label="Rejected"
              value={String(report.suggestionDecisions.rejected)}
              hint="not followed"
              icon="close-outline"
            />
            <StatCard
              label="Not reviewed"
              value={String(report.suggestionDecisions.notReviewed)}
              hint="awaiting a decision"
              icon="hourglass-outline"
            />
          </View>

          <Card tone="muted">
            <Collapse
              title="All aggregated values"
              subtitle="The exact figures exported by the share buttons"
            >
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
              <KeyValue
                label="Overall downtime (h)"
                value={fmtNumber(report.totals.overallDowntimeHours)}
              />
              <KeyValue
                label="Testing match rate"
                value={report.testing.matchRate === null ? '—' : `${report.testing.matchRate}%`}
              />
              <KeyValue
                label="Suggestions accepted"
                value={String(report.suggestionDecisions.accepted)}
              />
              <KeyValue
                label="Suggestions modified"
                value={String(report.suggestionDecisions.modified)}
              />
              <KeyValue
                label="Suggestions rejected"
                value={String(report.suggestionDecisions.rejected)}
              />
              <KeyValue
                label="Suggestions not reviewed"
                value={String(report.suggestionDecisions.notReviewed)}
              />
            </Collapse>
          </Card>

          <SectionHeader
            title="Export"
            icon="download-outline"
            subtitle="Share the same figures as a file for your report appendix."
          />
          <ButtonGroup>
            <Button title="Share JSON report" icon="download-outline" onPress={() => share('json')} />
            <Button
              title="Share CSV report"
              variant="secondary"
              icon="download-outline"
              onPress={() => share('csv')}
            />
          </ButtonGroup>
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md
  }
});
