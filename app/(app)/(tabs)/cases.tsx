import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
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
import { MaintenanceCase } from '../../../lib/types';
import { fmtDateTime, humanize } from '../../../lib/format';

function tone(status: MaintenanceCase['status']): 'info' | 'warning' | 'danger' | 'success' {
  if (status === 'completed') return 'success';
  if (status === 'reviewed') return 'info';
  if (status === 'analyzed') return 'warning';
  return 'danger';
}

export default function CasesScreen() {
  const router = useRouter();
  const [cases, setCases] = useState<MaintenanceCase[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setError('');
        try {
          const result = await api.get<{ cases: MaintenanceCase[] }>('/api/maintenance-cases');
          setCases(result.cases);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  return (
    <Screen>
      <ScreenHeader
        title="Maintenance cases"
        subtitle="Current problems analysed against real historical records."
        badge={cases.length ? <Badge text={`${cases.length} total`} tone="info" /> : undefined}
      />

      <Button
        title="Create maintenance case"
        icon="add-outline"
        onPress={() => router.push('/(app)/case/new')}
      />

      {error ? (
        <Notice tone="danger" title="Could not load cases">
          {error}
        </Notice>
      ) : null}

      {loading && cases.length === 0 ? <Loading label="Loading cases…" /> : null}

      {!loading && cases.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="No maintenance cases yet"
          message="Create a case to run an analysis against the machine's recorded history."
          action={{ title: 'Create maintenance case', onPress: () => router.push('/(app)/case/new') }}
        />
      ) : null}

      {cases.length ? (
        <SectionHeader
          title="Case list"
          icon="list-outline"
          subtitle="Tap a case to open its analysis and record your review."
        />
      ) : null}

      {cases.map((item) => {
        const machine = typeof item.machine === 'string' ? null : item.machine;
        return (
          <PressableCard key={item._id} onPress={() => router.push(`/(app)/case/${item._id}`)}>
            <View style={st.rowHead}>
              <Text style={st.rowTitle}>{item.caseNumber}</Text>
              <Badge text={humanize(item.status)} tone={tone(item.status)} />
            </View>
            <Muted>{machine ? `${machine.machineId} · ${machine.name}` : 'Machine'}</Muted>
            <Muted>{item.currentProblem}</Muted>
            <View style={st.chipRow}>
              <Chip label={fmtDateTime(item.dateReported)} icon="calendar-outline" />
              <Chip label={humanize(item.urgency)} icon="alert-circle-outline" />
            </View>
          </PressableCard>
        );
      })}
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
