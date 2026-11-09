import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Loading,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatCard,
  theme,
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { SensorReading } from '../../../lib/types';

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
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLatest = useCallback(async () => {
    try {
      const latest = await api.get<SensorReading | null>('/api/sensor-data/latest');
      setReading(latest);
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

  const isOnline =
    !!reading &&
    Date.now() - new Date(reading.date).getTime() < STALE_THRESHOLD_MS;

  return (
    <Screen>
      <ScreenHeader
        title="Sensors"
        subtitle="Live temperature & vibration from the compressor"
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

      {loading && !reading ? (
        <Loading label="Loading sensor data…" caption="Waiting for the ESP32 device." />
      ) : null}

      {!loading && !reading ? (
        <EmptyState
          icon="thermometer-outline"
          title="No sensor data yet"
          message="The ESP32 device has not sent any readings. Make sure it is powered on and connected to Wi-Fi."
        />
      ) : null}

      {reading ? (
        <>
          <SectionHeader
            title="Current reading"
            subtitle={`Last updated ${new Date(reading.date).toLocaleTimeString()}`}
            icon="timer-outline"
          />

          <View style={st.statRow}>
            <StatCard
              label="Temperature"
              value={`${reading.temperature.toFixed(1)} °C`}
              hint="DHT11 sensor"
              icon="thermometer-outline"
              tone="warning"
            />
            <StatCard
              label="Vibration"
              value={`${reading.vibration.toFixed(1)}`}
              hint="Analog sensor (0–20)"
              icon="speedometer-outline"
              tone={reading.vibration > 12 ? 'warning' : 'primary'}
            />
          </View>

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
                    <Text style={st.historyValue}>{r.temperature.toFixed(1)} °C</Text>
                    <Text style={st.historyLabel}>Vib:</Text>
                    <Text style={st.historyValue}>{r.vibration.toFixed(1)}</Text>
                    <Muted style={st.historySource}>{r.source}</Muted>
                  </View>
                  <Chip
                    label={r.syncedToFirebase ? 'Synced' : 'Pending'}
                    icon={r.syncedToFirebase ? 'checkmark-outline' : 'alert-outline'}
                    tone="success"
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
                        tone={selectedRange === opt.value ? 'primary' : 'warning'}
                      />
                    </Pressable>
                  ))}
                </View>
              }
            />
            {historicalLoading ? (
              <Loading label="Loading history…" caption="Fetching historical readings." />
            ) : historical.length === 0 ? (
              <Muted style={st.noHistory}>
                No historical data for the selected range. Ensure the ESP32 is sending readings.
              </Muted>
            ) : (
              <View style={st.historyList}>
                {historical.map((r) => (
                  <View key={r._id} style={st.historyRow}>
                    <Text style={st.historyTime}>
                      {new Date(r.date).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <View style={st.historyValues}>
                      <Text style={st.historyLabel}>Temp:</Text>
                      <Text style={st.historyValue}>{r.temperature.toFixed(1)} °C</Text>
                      <Text style={st.historyLabel}>Vib:</Text>
                      <Text style={st.historyValue}>{r.vibration.toFixed(1)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Button
            title="Refresh now"
            icon="refresh-outline"
            onPress={() => {
              loadLatest();
              loadHistory();
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
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