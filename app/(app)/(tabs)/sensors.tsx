import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  theme,
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { fmtDateTime, fmtNumber } from '../../../lib/format';
import { DEFAULT_MACHINE_ID } from '../../../lib/config';
import { machineStateApi, type MachineState } from '../../../lib/api/machineState';
import { SensorReading } from '../../../lib/types';
import {
  StatCard,
  StatusBadge,
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

export default function SensorsScreen() {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [historical, setHistorical] = useState<SensorReading[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>('24h');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const [machineState, setMachineState] = useState<Array<{
    state: MachineState;
    changedAt: number;
    changedBy: string | null;
  }>>([]);

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
      const recent = await api.get<SensorReading[]>(
        '/api/sensor-data/history?limit=10'
      );
      setHistory(recent);
    } catch {
      // History failure is non-fatal; latest reading is the priority.
    }
  }, []);

  const loadHistorical = useCallback(async () => {
    try {
      setHistoricalLoading(true);
      const data = await api.get<{
        range: string;
        startDate: string | null;
        count: number;
        readings: SensorReading[];
      }>(`/api/sensor-data/historical?range=${selectedRange}&limit=500`);

      // Fetch state transitions for the same visible time range so we can
      // shunt each reading onto the correct state bucket.
      const now = Date.now();
      const from = data.startDate ? new Date(data.startDate).getTime() : now - 7 * 86400000;
      try {
        const stateRes = await machineStateApi.getHistory(DEFAULT_MACHINE_ID, {
          limit: 100,
          from,
          to: now,
        });
        const sortedStates = [...stateRes.history].sort((a, b) => b.changedAt - a.changedAt);
        setMachineState(sortedStates);
      } catch (stateErr) {
        console.warn('[sensors.tsx] Failed to fetch machine state history:', stateErr);
      }

      setHistorical(data.readings);
    } catch {
      // Historical failure is non-fatal.
    } finally {
      setHistoricalLoading(false);
    }
  }, [selectedRange]);

  useFocusEffect(
    useCallback(() => {
      loadLatest();
      loadHistory();
      loadHistorical();
      intervalRef.current = setInterval(loadLatest, REFRESH_INTERVAL_MS);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [loadLatest, loadHistory, loadHistorical])
  );

  const refreshAll = useCallback(() => {
    loadLatest();
    loadHistory();
    loadHistorical();
  }, [loadLatest, loadHistory, loadHistorical]);

  const isOnline =
    !!reading &&
    Date.now() - new Date(reading.date).getTime() < STALE_THRESHOLD_MS &&
    browserOnline;

  const trendPoints = [...history]
    .reverse()
    .map((r) => ({
      label: new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
            subtitle={`Last updated ${fmtDateTime(reading.date)}`}
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
              label="Humidity"
              value={reading.humidity != null ? fmtNumber(reading.humidity, 0) : '—'}
              unit={reading.humidity != null ? '%' : undefined}
              hint="DHT11 sensor"
              icon="water-outline"
            />
            <StatCard
              label="Last update"
              value={new Date(reading.date).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              hint={isOnline ? 'Receiving data' : 'Stale'}
              icon="time-outline"
            />
          </View>

          <Card>
            <SectionHeader title="Temperature trend" icon="analytics-outline" />
            <TrendChart title="" unit="°C" points={trendPoints} />
          </Card>

          <Card tone="muted">
            <SectionHeader title="Recent readings" icon="timer-outline" />
            <View style={st.historyList}>
              {history.map((r) => (
                <View key={r._id} style={st.historyRow}>
                  <Text style={st.historyTime}>
                    {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={st.historyValues}>
                    <Text style={st.historyLabel}>Temp:</Text>
                    <Text style={st.historyValue}>{fmtNumber(r.temperature, 1)} °C</Text>
                    <Text style={st.historyLabel}>Vib:</Text>
                    <Text style={st.historyValue}>{fmtNumber(r.vibration)}</Text>
                    <Muted style={st.historySource}>{r.source}</Muted>
                  </View>
                  <StatusBadge
                    label={r.syncedToFirebase ? 'Synced' : 'Pending'}
                    tone={r.syncedToFirebase ? 'success' : 'warning'}
                  />
                </View>
              ))}
              {history.length === 0 && (
                <Muted style={st.noHistory}>No recent readings.</Muted>
              )}
            </View>
          </Card>

          {/* Historical data view */}
          <Card tone="muted">
            <SectionHeader
              title="Historical readings"
              icon="list-outline"
              action={
                <View style={st.rangeSelector}>
                  {RANGE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setSelectedRange(opt.value);
                        loadHistorical();
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
            {historicalLoading ? (
              <LoadingSkeleton count={2} />
            ) : historical.length === 0 ? (
              <Muted style={st.noHistory}>
                No historical data for the selected range. Ensure the ESP32 is sending readings.
              </Muted>
            ) : (
              <View style={st.historyList}>
                {historical.map((r) => {
                  const activeState = machineState.filter(t => t.changedAt <= r.date)
                    .sort((a, b) => b.changedAt - a.changedAt)[0]?.state ?? null;
                  const bgColor = activeState === 'starting' ? 'rgba(251, 191, 36, 0.15)' :
                                  activeState === 'stopped' ? 'rgba(100, 116, 139, 0.15)' : undefined;
                  return (
                    <View key={r._id} style={[st.historyRow, { backgroundColor: bgColor }]}>
                    <Text style={st.historyTime}>
                      {fmtDateTime(r.date)}
                    </Text>
                    <Text style={st.historyState}>
                      {activeState === 'starting' ? 'Starting' :
                       activeState === 'stopped' ? 'Stopped' : 'Operating'}
                    </Text>
                    <View style={st.historyValues}>
                      <Text style={st.historyLabel}>Temp:</Text>
                      <Text style={st.historyValue}>{fmtNumber(r.temperature, 1)} °C</Text>
                      <Text style={st.historyLabel}>Vib:</Text>
                      <Text style={st.historyValue}>{fmtNumber(r.vibration)}</Text>
                    </View>
                  </View>
                );
              })}
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
    paddingVertical: theme.space.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  historyState: {
    ...theme.font.caption,
    color: theme.textMuted,
    fontWeight: '600' as const,
  },
  historyTime: {
    ...theme.font.captionMedium,
    color: theme.text,
    minWidth: 70,
  },
  historyValues: {
    flexDirection: 'row',
    gap: theme.space.md,
    flex: 1,
    alignItems: 'center',
  },
  historyLabel: {
    ...theme.font.caption,
    color: theme.textMuted,
    marginRight: theme.space.xs,
  },
  historyValue: {
    ...theme.font.captionMedium,
    color: theme.text,
    fontWeight: '600' as const,
    marginRight: theme.space.sm,
  },
  historySource: {
    ...theme.font.caption,
    color: theme.textSubtle,
    fontStyle: 'italic',
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



