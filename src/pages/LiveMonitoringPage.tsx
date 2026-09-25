import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sun, Pause, Play } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, ConditionBadge, Button } from '../components/ui';
import { Sparkline } from '../components/charts';
import { store } from '../services/store';
import { getReadings, getLatestReading } from '../services/sensorService';
import { PARAM_META } from '../utils/params';

export default function LiveMonitoringPage() {
  const state = useAppState();

  const toggleFeed = () => store.update((s) => ({ ...s, simulation: { ...s.simulation, enabled: !s.simulation.enabled } }));
  const changeInterval = (v: string) => {
    const n = Math.max(2, Number(v) || 5);
    store.update((s) => ({ ...s, simulation: { ...s.simulation, intervalSeconds: n } }));
  };

  const eqs = state.equipment;
  const when = (iso: string) => new Date(iso).toLocaleTimeString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Monitoring"
        subtitle="Real-time sensor feed (simulated IoT source)"
        actions={
          <Button onClick={toggleFeed} variant={state.simulation.enabled ? 'secondary' : 'primary'}>
            {state.simulation.enabled ? <><Pause className="h-4 w-4" /> Pause feed</> : <><Play className="h-4 w-4" /> Start feed</>}
          </Button>
        }
      />

      {!state.simulation.enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="flex items-center gap-2"><Sun className="h-4 w-4" /><span className="font-medium">Simulation is paused.</span> Start the feed to see readings arrive in real time, or open an equipment to view its historical trends.</p>
        </div>
      )}

      <Card title="Simulation settings" subtitle="How often a new sample is generated">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-600">Sample interval (seconds):</span>
          <select value={String(state.simulation.intervalSeconds)} onChange={(e) => changeInterval(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {[2, 5, 10, 20].map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {eqs.map((e) => {
          const hist = getReadings(e.equipmentId).slice(-12);
          const last = hist[hist.length - 1] || getLatestReading(e.equipmentId);
          return (
            <Card
              key={e.id}
              title={e.equipmentId + ' · ' + e.name}
              subtitle={e.location}
              actions={<ConditionBadge status={e.status} />}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {last ? (['temperature', 'vibration', 'voltage', 'current'] as const).map((k) => (
                    <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="text-[11px] text-slate-500">{PARAM_META[k].label}</p>
                      <p className="font-semibold">{last[k]} <span className="text-[11px] text-slate-400">{PARAM_META[k].unit}</span></p>
                    </div>
                  )) : <p className="text-sm text-slate-500">No data</p>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{last ? 'Updated ' + when(last.timestamp) : ''}</span>
                  {hist.length >= 2 && <Sparkline data={hist.map((r) => r.temperature)} color="#f97316" width={110} />}
                </div>
                <Link to={'/equipment/' + e.equipmentId} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  Details <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}