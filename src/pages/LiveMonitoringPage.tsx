import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Activity } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, ConditionBadge } from '../components/ui';
import { Sparkline } from '../components/charts';
import { latestReading, history } from '../services/realtimeService';
import { PARAM_META } from '../utils/params';
import { classifyValue } from '../utils/calc';
import { worstCondition as worst } from '../utils/score';
import { Condition, Level } from '../types';

export default function LiveMonitoringPage() {
  const state = useAppState();
  const eq = state.equipment[0];
  const latest = latestReading();
  const hist = history(12);

  // Same classification the dashboard uses, so this card stays in sync with
  // the live condition indicator. Threshold bands are already absolute, so we
  // classify directly against them.
  let status: Condition = 'NORMAL';
  let tempLevel: Level = 'normal';
  let vibLevel: Level = 'normal';
  const th = eq?.thresholds;
  if (th && latest) {
    tempLevel = classifyValue(th.temperature, latest.temperature);
    vibLevel = classifyValue(th.vibration, latest.vibration);
    status = worst([tempLevel, vibLevel]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Monitoring"
        subtitle="Real-time sensor feed (simulated IoT source)"
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Live feed
          </div>
        }
      />

      <Card
        title="Main Compressor"
        subtitle="CMP-001 · Utility Plant - Bay 1"
        actions={<ConditionBadge status={status} />}
        bodyClassName="!p-4"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {latest && (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="text-[11px] text-slate-500">{PARAM_META.temperature.label}</p>
                  <p className="font-semibold">
                    {latest.temperature.toFixed(1)} <span className="text-[11px] text-slate-400">{PARAM_META.temperature.unit}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="text-[11px] text-slate-500">{PARAM_META.vibration.label}</p>
                  <p className="font-semibold">
                    {latest.vibration.toFixed(1)} <span className="text-[11px] text-slate-400">{PARAM_META.vibration.unit}</span>
                  </p>
                </div>
              </>
            )}
            {!latest && <p className="text-sm text-slate-500">No data yet</p>}
          </div>

          {hist.length >= 2 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-400">
                {latest ? `Updated ${new Date(latest.timestamp).toLocaleTimeString()}` : 'No data yet'} · {tempLevel} / {vibLevel}
              </span>
              <div className="flex gap-4">
                <Sparkline data={hist.map((r) => r.temperature)} color="#f97316" width={110} />
                <Sparkline data={hist.map((r) => r.vibration)} color="#8b5cf6" width={110} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Condition</span>
            <span className="font-semibold">
              {status.toUpperCase()} · {tempLevel} / {vibLevel}
            </span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Back to dashboard <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
