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
// Two live-data sources:
//   1. Firebase Realtime DB (path: sensorReadings) — device/hardware readings
//      pushed by the ESP32 via POST /api/devices/readings, synced to Firebase
//      by the backend. This is the production real-time path.
//   2. Local polling fallback — simulated readings generated client-side when
//      no Firebase SDK is available (development / no-instrumentation mode).
//
// NOTE: The SSE path (GET /api/sensor-data/stream) does NOT exist on the
// backend and has been removed. Do not re-add it without also implementing
// the backend endpoint.
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

let feedInterval: number | null = null;
let activeMode: 'polling' | 'none' = 'none';
let firebaseUnsubscribe: (() => void) | null = null;
const seenFirebaseTimestamps = new Set<string>();
let firebaseCleanup: (() => void) | undefined;

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

  startPolling(intervalSeconds);

  return () => {
    if (firebaseCleanup) firebaseCleanup();
    stopFeed();
  };
}

export function stopFeed(): void {
  activeMode = 'none';

  if (feedInterval !== null) {
    clearInterval(feedInterval);
    feedInterval = null;
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
      // Accept both epoch-ms numbers (new) and ISO strings (old Firebase entries)
      const rawTimestamp = data.timestamp ?? Date.now();
      const timestamp = typeof rawTimestamp === 'string' ? new Date(rawTimestamp).getTime() : rawTimestamp;
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

export function getFeedMode(): 'polling' | 'none' {
  return activeMode;
}