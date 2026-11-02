import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, TriangleAlert, TrendingUp, AlertCircle, Signal, WifiOff } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, StatCard, EmptyState } from '../components/ui';
import { ConditionGauge, TrendLineChart } from '../components/charts';
import { getCompressor, latestReading, history, getFeedMode } from '../services/realtimeService';
import { AnomalyAlert, Condition, Level } from '../types';
import { classifyValue } from '../utils/calc';
import { worstCondition } from '../utils/score';
import { fmtDateTime } from '../utils/params';

export default function DashboardPage() {
  const state = useAppState();
  const eq = getCompressor();
  const latest = latestReading();
  const hist = history(24);

  let status: Condition = 'NORMAL';
  let tempLevel: Level = 'normal';
  let vibLevel: Level = 'normal';
  const th = eq?.thresholds;
  if (th && latest) {
    tempLevel = classifyValue(th.temperature, latest.temperature);
    vibLevel = classifyValue(th.vibration, latest.vibration);
    status = worstCondition([tempLevel, vibLevel]);
  }

  const trendRows = hist.map((r) => ({
    label: fmtDateTime(r.timestamp).slice(0, 16),
    Temperature: r.temperature,
    Vibration: r.vibration
  }));

  const alerts: AnomalyAlert[] = state.anomalies.slice(-5).reverse();

  const statusLabel = { NORMAL: 'Stable', WARNING: 'At risk', CRITICAL: 'Critical', OFFLINE: 'Offline' } as Record<Condition, string>;
  const statusGauge = { NORMAL: 95, WARNING: 55, CRITICAL: 15, OFFLINE: 30 } as Record<Condition, number>;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Compressor Overview"
        subtitle="Main compressor (CMP-001) · live sensor feed"
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Live feed
          </div>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-4">
        <StatCard label="Condition" value={status} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Temperature" value={latest ? `${latest.temperature.toFixed(1)} °C` : '—'} icon={<TriangleAlert className="h-4 w-4" />} />
        <StatCard label="Vibration" value={latest ? `${latest.vibration.toFixed(1)} mm/s` : '—'} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Alerts" value={alerts.length} icon={<AlertCircle className="h-4 w-4" />} />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Current readings" subtitle="Latest sample" bodyClassName="!p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Temperature</p>
              <p className="text-2xl font-semibold">{latest ? `${latest.temperature.toFixed(1)} °C` : '—'}</p>
              <p className={`text-xs font-medium ${tempLevel === 'normal' ? 'text-green-600' : tempLevel === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                {tempLevel.toUpperCase()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Vibration</p>
              <p className="text-2xl font-semibold">{latest ? `${latest.vibration.toFixed(1)} mm/s` : '—'}</p>
              <p className={`text-xs font-medium ${vibLevel === 'normal' ? 'text-green-600' : vibLevel === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                {vibLevel.toUpperCase()}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Sensor trend" subtitle="Temperature & vibration">
          {trendRows.length > 1 ? (
            <TrendLineChart
              rows={trendRows}
              series={[
                { dataKey: 'Temperature', stroke: '#f97316', name: 'Temperature (°C)' },
                { dataKey: 'Vibration', stroke: '#8b5cf6', name: 'Vibration (mm/s)' }
              ]}
              height={220}
            />
          ) : (
            <EmptyState title="No readings yet" />
          )}
        </Card>

        <Card title="Condition gauge" subtitle="From latest sample" bodyClassName="!p-4">
          <div className="flex flex-col items-center gap-2">
            <ConditionGauge value={statusGauge[status]} label={statusLabel[status]} />
            <p className="text-xs text-slate-400">Latest sample</p>
          </div>
        </Card>
      </div>

      <Card title="Anomaly alerts" subtitle="Rule-based detections (temperature & vibration)">
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">No anomalies detected.</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      a.severity === 'critical'
                        ? 'text-red-700'
                        : a.severity === 'warning'
                        ? 'text-amber-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {a.severity.toUpperCase()} · {a.parameterLabel}
                  </span>
                  <span className="text-xs text-slate-400">{fmtDateTime(a.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{a.reason}</p>
                <p className="mt-1 text-sm text-slate-600">&#8203;{a.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
