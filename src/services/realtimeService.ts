import { store } from './store';
import { getLatestReading, getReadings, addReading } from './sensorService';
import { generateSimulatedReading } from './simulatedSource';
import { Equipment, SensorReading } from '../types';

// ---------------------------------------------------------------------------
// Real-time data service.
//
// Best fit for this stack: POLLLING via setInterval.
//
// Why polling here:
//   - The UI currently stores readings in-memory (localStorage-backed) and is
//     not wired to the backend REST API for sensor data. WebSockets would
//     require a new dependency plus server + connection handling; SSE would
//     require EventSource handling and a dev-server proxy. Polling matches the
//     existing "simulated feed" loop, needs zero new dependencies, and keeps
//     the app working offline.
//   - The backend exposes SSE endpoints (/api/sensor-data/stream) and a
//     POST /api/sensor-data ingestion endpoint. If/when the frontend is wired
//     to a live backend, switch this loader to EventSource instead of
//     setInterval and the app still benefits from the same service shape.
//
// The feed can be started/stopped from any component that needs live updates.
// ---------------------------------------------------------------------------

/** Returns the single fixed compressor (the rest of the app now manages one machine). */
export function getCompressor(): Equipment | undefined {
  return store.get().equipment[0];
}

/** Latest reading for the compressor, or undefined when no data exists yet. */
export function latestReading(): SensorReading | undefined {
  const eq = getCompressor();
  if (!eq) return undefined;
  return getLatestReading(eq.equipmentId);
}

/** Recent history (default 60 readings) for charting/trend work. */
export function history(limit = 60): SensorReading[] {
  const eq = getCompressor();
  if (!eq) return [];
  return getReadings(eq.equipmentId).slice(-limit);
}

let feedInterval: number | null = null;

/**
 * Start the simulated feeding loop for the compressor.
 * Returns a cleanup function that stops the loop.
 */
export function startFeed(intervalSeconds = 5): () => void {
  const eq = getCompressor();
  if (!eq) return () => {};

  feedInterval = window.setInterval(() => {
    const sample = generateSimulatedReading(eq);
    addReading({ ...sample, observation: 'Simulated real-time feed' });
  }, Math.max(2000, intervalSeconds * 1000));

  return () => stopFeed();
}

export function stopFeed(): void {
  if (feedInterval !== null) {
    clearInterval(feedInterval);
    feedInterval = null;
  }
}
