import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Loading,
  Muted,
  Notice,
  PressableCard,
  Screen,
  ScreenHeader,
  SectionHeader,
  theme
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { AlertItem, AlertSummary } from '../../../../lib/types';

function severityTone(severity: AlertItem['severity']): 'info' | 'warning' | 'danger' {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

export default function AlertsListScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [alertResult, summaryResult] = await Promise.all([
        api.get<{ alerts: AlertItem[]; total: number; page: number; limit: number }>('/api/alerts?resolved=false'),
        api.get<AlertSummary>('/api/alerts/summary'),
      ]);
      setAlerts(alertResult.alerts);
      setSummary(summaryResult);
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
        title="Alerts"
        subtitle="Anomaly pipeline detections ready for review and resolution."
        badge={summary ? <Badge text={`${summary.openCount} open`} tone="danger" /> : undefined}
      />

      {error ? (
        <Notice tone="danger" title="Could not load alerts">
          {error}
        </Notice>
      ) : null}

      {loading && alerts.length === 0 ? (
        <Loading label="Loading alerts…" />
      ) : null}

      {!loading && alerts.length === 0 ? (
        <EmptyState
          icon="warning-outline"
          title="No alerts"
          message="The anomaly detection pipeline has not produced any open alerts for this machine."
          action={{ title: 'Reload', onPress: load }}
        />
      ) : null}

      {!loading && alerts.length > 0 ? (
        <>
          <SectionHeader
            title="Open alerts"
            icon="warning-outline"
            subtitle="Newest detections first. Tap an alert to see its linked case and failure record."
          />
          {alerts.map((item) => (
            <PressableCard key={item._id} onPress={() => router.push(`/(app)/(tabs)/alerts/${item._id}`)}>
              <View style={st.rowHead}>
                <Text style={st.rowTitle}>{item.message}</Text>
                <Badge text={item.severity} tone={severityTone(item.severity)} />
              </View>
              <Muted>{item.machine}</Muted>
              <Muted>{item.parameter ? `${item.parameter} — z-score ${item.zScore}` : 'No parameter'}</Muted>
              <View style={st.chipRow}>
                <Chip label={item.linkedMaintenanceCase ? 'Linked case' : 'No case'} icon="clipboard-outline" />
                <Chip label={item.linkedFailureRecord ? 'Linked failure' : 'No failure'} icon="warning-outline" />
              </View>
            </PressableCard>
          ))}
        </>
      ) : null}
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
