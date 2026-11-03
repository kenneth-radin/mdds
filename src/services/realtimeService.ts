import { store } from './store';
import { getLatestReading, getReadings, addReading } from './sensorService';
import { generateSimulatedReading } from './simulatedSource';
import { Equipment, SensorReading } from '../types';
import { API_URL } from '../../lib/config';
// @ts-ignore - the firebaseConfig.js module deliberately re-exports a
// defensive, dynamically-loaded getFirebase(); its types are best-effort.
import { getFirebase } from '../firebaseConfig';

// ---------------------------------------------------------------------------
// Real-time data service.
//
// Supports TWO modes:
//   1. SSE — connects to the Render backend stream and receives live sensor
//      readings pushed from the server. Also posts simulated readings to
//      POST /api/sensor-data so data flows.
//   2. Polling fallback — local setInterval simulated feed into localStorage
//      (used when the backend is unreachable or no API URL is set).
//
// Public API shape stays the same regardless of mode.
// ---------------------------------------------------------------------------

export function getCompressor(): Equipment | undefined {
  return store.get().equipment[0];
}

export function latestReading(): SensorReading | undefined {
  const eq = getCompressor();
  if (!eq) return undefined;
  return getLatestReading(eq.equipmentId);
}

export function history(limit = 60): SensorReading[] {
  const eq = getCompressor();
  if (!eq) return [];
  return getReadings(eq.equipmentId).slice(-limit);
}

let sseEventSource: EventSource | null = null;
let feedInterval: number | null = null;
let postInterval: number | null = null;
let activeMode: 'sse' | 'polling' | 'none' = 'none';
let firebaseUnsubscribe: (() => void) | null = null;
const seenFirebaseTimestamps = new Set<string>();
let firebaseCleanup: (() => void) | undefined;

function connectSSE(intervalSeconds = 5): void {
  const eq = getCompressor();
  if (!eq) return;

  const url = `${API_URL}/api/sensor-data/stream?machineId=${eq.equipmentId}`;
  sseEventSource = new EventSource(url);

  sseEventSource.onopen = () => {
    activeMode = 'sse';
    console.log('[realtime] SSE stream connected');
  };

  sseEventSource.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.sample === 'SSE stream open') return;
      if (data.temperature !== undefined && data.vibration !== undefined) {
        const reading: SensorReading = {
          id: data.id,
          equipmentId: data.equipmentId || eq.equipmentId,
          timestamp: (data.timestamp || '') as string,
          temperature: data.temperature,
          vibration: data.vibration,
          voltage: data.voltage ?? 0,
          current: data.current ?? 0,
          operatingHours: data.operatingHours ?? 0,
          observation: data.observation || 'Live backend feed',
          source: 'live',
        };
        addReading(reading);
      }
    } catch {
      // ignore malformed SSE events
    }
  };

  sseEventSource.onerror = () => {
    sseEventSource?.close();
    sseEventSource = null;
    activeMode = 'none';
    console.warn('[realtime] SSE stream error, falling back to polling');
    startPolling(intervalSeconds);
  };

  postInterval = window.setInterval(() => {
    try {
      const sample = generateSimulatedReading(eq);
      void fetch(`${API_URL}/api/sensor-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: sample.temperature,
          vibration: sample.vibration,
          operatingHours: sample.operatingHours,
          /* @ts-ignore */
timestamp: sample.timestamp,
          source: 'simulated',
        }),
      });
    } catch {
      // ignore POST failures
    }
  }, Math.max(2000, intervalSeconds * 1000));
}

function startPolling(intervalSeconds = 5): void {
  activeMode = 'polling';
  feedInterval = window.setInterval(() => {
    const eq = getCompressor();
    if (!eq) return;
    try {
      const sample = generateSimulatedReading(eq);
      addReading({ ...sample, observation: 'Simulated real-time feed' });
    } catch {
      // ignore
    }
  }, Math.max(2000, intervalSeconds * 1000));
}

export function startFeed(intervalSeconds = 5): () => void {
  stopFeed();

  const eq = getCompressor();
  if (!eq) return () => {};

  // Kick off the optional Firebase live feed (fire-and-forget). It only
  // activates once the optional firebase SDK is installed, which keeps the
  // main feed path synchronous.
  void startFirebaseFeed().then((cleanup) => {
    firebaseCleanup = cleanup;
  });

  if (API_URL && API_URL !== 'http://localhost:4000') {
    connectSSE(intervalSeconds);
  } else {
    startPolling(intervalSeconds);
  }

  return () => {
    if (firebaseCleanup) firebaseCleanup();
    stopFeed();
  };
}

export function stopFeed(): void {
  activeMode = 'none';

  if (sseEventSource) {
    sseEventSource.close();
    sseEventSource = null;
  }

  if (feedInterval !== null) {
    clearInterval(feedInterval);
    feedInterval = null;
  }

  if (postInterval !== null) {
    clearInterval(postInterval);
    postInterval = null;
  }

  if (firebaseUnsubscribe) {
    firebaseUnsubscribe();
    firebaseUnsubscribe = null;
  }
}

export async function startFirebaseFeed(): Promise<(() => void) | undefined> {
  const { database } = await getFirebase();
  if (!database) return undefined;

  const readingsRef = database.ref('sensorReadings').limitToLast(100);

  firebaseUnsubscribe = readingsRef.on('value', (snapshot: any) => {
    snapshot.forEach((child: any) => {
      const data = child.val();
      if (data === null || data.temperature === undefined || data.vibration === undefined) return;
      const timestamp = String(data.timestamp ?? Date.now());
      if (seenFirebaseTimestamps.has(timestamp)) return;
      seenFirebaseTimestamps.add(timestamp);

      try {
        addReading({
          equipmentId: String(data.equipmentId ?? 'CMP-001'),
          temperature: Number(data.temperature),
          vibration: Number(data.vibration),
          voltage: 0,
          current: 0,
          operatingHours: data.operatingHours ? Number(data.operatingHours) : 0,
          timestamp,
          source: data.source ?? 'firebase',
        });
      } catch {
        // ignore malformed entries
      }
    });
  });

  return () => {
    if (firebaseUnsubscribe) {
      firebaseUnsubscribe();
      firebaseUnsubscribe = null;
    }
  };
}

export function getFeedMode(): 'sse' | 'polling' | 'none' {
  return activeMode;
}