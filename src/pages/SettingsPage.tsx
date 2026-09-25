import React, { useState } from 'react';
import { RefreshCw, Sun, Timer, Gauge, SlidersHorizontal } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, Field, Button } from '../components/ui';
import { store } from '../services/store';

export default function SettingsPage() {
  const state = useAppState();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="System configuration" />

      <Card title="Live simulation" subtitle="Control the simulated IoT sensor feed">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.simulation.enabled} onChange={(e) => store.update((s) => ({ ...s, simulation: { ...s.simulation, enabled: e.target.checked } }))} className="h-4 w-4" />
          Enable live simulation
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Sample interval (seconds)">
            <input type="number" min="1" value={state.simulation.intervalSeconds} onChange={(e) => { const n = Math.max(1, Number(e.target.value) || 5); store.update((s) => ({ ...s, simulation: { ...s.simulation, intervalSeconds: n } })); }} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Sample speed (multiplier)">
            <input type="number" min="0.5" step="0.1" value={state.simulation.speed} onChange={(e) => { const n = Math.max(0.5, Number(e.target.value) || 1); store.update((s) => ({ ...s, simulation: { ...s.simulation, speed: n } })); }} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Noise jitter">
            <input type="number" min="0" step="0.05" value={state.simulation.jitter} onChange={(e) => { const n = Math.max(0, Number(e.target.value) || 0.3); store.update((s) => ({ ...s, simulation: { ...s.simulation, jitter: n } })); }} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </Field>
        </div>
      </Card>

      <Card title="Condition score weights" subtitle="Contribution of each parameter to the 0–100 condition score">
        <p className="text-sm text-slate-600">The condition score is the weighted sum of the parameters, weighted by their risk level. Adjusting the simulator or thresholds below reflects immediately.</p>
      </Card>

      <Card title="Data" subtitle="Manage the demo database">
        <p className="text-sm text-slate-600">Reset wipes all equipment, sensor history, maintenance, recommendations and rules back to the seeded demo data.</p>
        <Button onClick={() => { if (window.confirm('Reset all data to the seeded demo dataset?')) store.reset(); }} variant="danger">
          <RefreshCw className="h-4 w-4" /> Reset demo data
        </Button>
      </Card>
    </div>
  );
}