import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Notice,
  Screen,
  ScreenHeader,
  theme,
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { fmtNumber } from '../../../lib/format';
import { DEFAULT_MACHINE_ID } from '../../../lib/config';
import { SensorReading } from '../../../lib/types';
import {
  StatCard,
  SectionHeader,
  LoadingSkeleton,
  TrendChart,
  ScreenContainer,
} from '../../../src/components';
import { useBrowserOnline } from '../../../src/components/useOnlineStatus';

const REFRESH_INTERVAL_MS = 5000;
const STALE_THRESHOLD_MS = 30000;

const RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
];

function shortTime(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SensorsScreen() {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>('24h');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const browserOnline = useBrowserOnline();

  const loadLatest = useCallback(async () => {
    try {
      const latest = await api.get<SensorReading | null>('/api/sensor-data/latest');
      setReading(latest);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const data = await api.get<{ readings: SensorReading[] }>(
        `/api/sensor-data/historical?range=${selectedRange}&limit=20`
      );
      setHistory(data.readings);
    } catch {
      // History failure is non-fatal; latest reading is the priority.
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedRange]);

  useFocusEffect(
    useCallback(() => {
      loadLatest();
      loadHistory();
      intervalRef.current = setInterval(loadLatest, REFRESH_INTERVAL_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [loadLatest, loadHistory])
  );

  const refreshAll = useCallback(() => {
    loadLatest();
    loadHistory();
  }, [loadLatest, loadHistory]);

  const isOnline =
    !!reading &&
    Date.now() - new Date(reading.date).getTime() < STALE_THRESHOLD_MS &&
    browserOnline;

  const trendPoints = [...history]
    .reverse()
    .map((r) => ({
      label: shortTime(r.date),
      value: r.temperature,
    }));

  return (
    <Screen>
      <ScreenContainer>
        <ScreenHeader
          title="Main Compressor"
          subtitle={`${DEFAULT_MACHINE_ID} · Live temperature & vibration`}
          badge={
            <Chip
              label={isOnline ? 'Online' : 'Offline'}
              icon={isOnline ? 'wifi-outline' : 'alert-outline'}
              tone={isOnline ? 'success' : 'warning'}
            />
          }
        />

        {error ? (
          <Notice tone="danger" title="Could not load sensor data">{error}</Notice>
        ) : null}

        {error && !loading ? (
          <View style={st.retryWrap}>
            <Button title="Retry" icon="refresh-outline" onPress={refreshAll} />
          </View>
        ) : null}

        {loading && !reading ? <LoadingSkeleton count={3} /> : null}

        {!loading && !reading && !error ? (
          <EmptyState
            icon="thermometer-outline"
            title="No readings yet"
            message="The ESP32 device has not sent any readings. Make sure it is powered on and connected to Wi-Fi."
            action={{ title: 'Refresh', onPress: refreshAll }}
          />
        ) : null}

      {reading ? (
        <>
          <SectionHeader
            title="Current reading"
            subtitle={`Last updated ${shortTime(reading.date)}`}
            icon="timer-outline"
          />

          <View style={st.statRow}>
            <StatCard
              label="Temperature"
              value={fmtNumber(reading.temperature, 1)}
              unit="°C"
              hint="DHT11 sensor"
              icon="thermometer-outline"
            />
            <StatCard
              label="Vibration"
              value={fmtNumber(reading.vibration)}
              hint="0 = none · 5 = detected"
              icon="speedometer-outline"
            />
            <StatCard
              label="Last update"
              value={shortTime(reading.date)}
              hint={isOnline ? 'Receiving data' : 'Stale'}
              icon="time-outline"
            />
          </View>

          <Card>
            <SectionHeader title="Temperature trend" icon="analytics-outline" />
            <TrendChart title="" unit="°C" points={trendPoints} />
          </Card>

          <Card tone="muted">
            <SectionHeader
              title="Recent readings"
              icon="timer-outline"
              action={
                <View style={st.rangeSelector}>
                  {RANGE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setSelectedRange(opt.value);
                        loadHistory();
                      }}
                    >
                      <Chip
                        label={opt.label}
                        tone={selectedRange === opt.value ? 'primary' : 'default'}
                      />
                    </Pressable>
                  ))}
                </View>
              }
            />
            {historyLoading ? (
              <LoadingSkeleton count={3} />
            ) : history.length === 0 ? (
              <Text style={st.noHistory}>No readings in this range.</Text>
            ) : (
              <View style={st.historyList}>
                <View style={[st.historyRow, st.historyHead]}>
                  <Text style={[st.historyTime, st.historyHeadText]}>Time</Text>
                  <Text style={[st.historyValue, st.historyHeadText]}>Temp</Text>
                  <Text style={[st.historyValue, st.historyHeadText]}>Vib</Text>
                </View>
                {history.slice(0, 8).map((r) => (
                  <View key={r._id} style={st.historyRow}>
                    <Text style={st.historyTime}>{shortTime(r.date)}</Text>
                    <Text style={st.historyValue}>{fmtNumber(r.temperature, 1)} °C</Text>
                    <Text style={st.historyValue}>{fmtNumber(r.vibration)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Button
            title="Refresh now"
            icon="refresh-outline"
            onPress={refreshAll}
          />
        </>
      ) : null}
      </ScreenContainer>
    </Screen>
  );
}

const st = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
  },
  retryWrap: {
    marginBottom: theme.space.sm,
  },
  historyList: {
    paddingVertical: theme.space.xs,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
    gap: theme.space.md,
  },
  historyTime: {
    ...theme.font.captionMedium,
    color: theme.textMuted,
    width: 72,
  },
  historyHead: {
    borderBottomWidth: 2,
    borderBottomColor: theme.divider,
  },
  historyHeadText: {
    ...theme.font.caption,
    color: theme.textSubtle,
    fontWeight: '700' as const,
  },
  historyValue: {
    ...theme.font.captionMedium,
    color: theme.text,
    fontWeight: '600' as const,
    minWidth: 56,
    textAlign: 'right',
  },
  noHistory: {
    ...theme.font.caption,
    color: theme.textMuted,
    textAlign: 'center',
    paddingVertical: theme.space.sm,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: theme.space.xs,
    alignItems: 'center',
  },
});



