import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cog, Activity, TriangleAlert, CheckCircle2, TrendingUp, Wrench, ChevronRight } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, StatCard, ConditionBadge, EmptyState } from '../components/ui';
import { ConditionGauge, TrendLineChart, SimpleBarChart, Sparkline, Donut } from '../components/charts';
import { getReadings, getLatestReading } from '../services/sensorService';
import { listEquipment } from '../services/equipmentService';
import { processReading } from '../services/processingService';
import { evaluateRules } from '../rules/engine';
import { determineMaintenanceNeed } from '../services/conditionService';
import { scoreCondition, generatePrediction } from '../services/predictiveService';
import { riskPercent } from '../utils/score';
import { resolveThresholds } from '../utils/calc';
import { PARAM_ORDER, PARAM_META } from '../utils/params';
import { listRecommendations } from '../services/recommendationService';

export default function DashboardPage() {
  const state = useAppState();
  const [spotlightId, setSpotlightId] = useState<string>(() => {
    const c = listEquipment().find((e) => e.status === 'CRITICAL');
    return c ? c.id : listEquipment()[0]?.id || '';
  });

  const eqs = listEquipment();
  const summary = useAppState() && state;
  const counts = {
    total: eqs.length,
    normal: eqs.filter((e) => e.status === 'NORMAL').length,
    warning: eqs.filter((e) => e.status === 'WARNING').length,
    critical: eqs.filter((e) => e.status === 'CRITICAL').length,
    offline: eqs.filter((e) => e.status === 'OFFLINE' || !e.monitoringEnabled).length
  };
  const pending = listRecommendations().filter((r) => r.decision === 'pending');

  // Fleet history (averaged) for the trend chart + risk by parameter.
  const HIST = 24;
  const histByEq = eqs.map((eq) => ({ eq, hist: getReadings(eq.equipmentId).slice(-HIST) }));
  const len = Math.max(...histByEq.map((x) => x.hist.length), 2);
  const trendRows: Record<string, unknown>[] = [];
  for (let i = 0; i < len - 1; i++) {
    const sums: Record<string, number> = { temperature: 0, vibration: 0, voltage: 0, current: 0 };
    let cnt = 0;
    let label = '';
    for (const { hist } of histByEq) {
      const r = hist[i];
      if (!r) continue;
      cnt++;
      sums.temperature += r.temperature;
      sums.vibration += r.vibration;
      sums.voltage += r.voltage;
      sums.current += r.current;
      label = new Date(r.timestamp).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (cnt === 0) continue;
    trendRows.push({
      label,
      Temperature: Math.round((sums.temperature / cnt) * 10) / 10,
      Vibration: Math.round((sums.vibration / cnt) * 100) / 100,
      Voltage: Math.round((sums.voltage / cnt) * 10) / 10,
      'Motor Current': Math.round((sums.current / cnt) * 10) / 10
    });
  }

  const riskByParam = PARAM_ORDER.map((key) => {
    const values = eqs.map((eq) => {
      const latest = getLatestReading(eq.equipmentId);
      if (!latest) return 0;
      return riskPercent(resolveThresholds(eq)[key], latest[key]);
    });
    return { label: PARAM_META[key].label, value: Math.round((values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1)) * 10) / 10 };
  });
  const riskColor = (label: string) => {
    const v = riskByParam.find((r) => r.label === label)?.value || 0;
    return v >= 70 ? '#dc2626' : v >= 40 ? '#f59e0b' : '#16a34a';
  };

  const spotlight = eqs.find((e) => e.id === spotlightId) || eqs[0];
  let spotScore = 0;
  let spotCondition = 'NORMAL';
  if (spotlight) {
    const hist = getReadings(spotlight.equipmentId);
    const latest = hist[hist.length - 1];
    if (latest) {
      const pr = processReading(spotlight, latest, hist.slice(0, -1));
      const triggered = evaluateRules(state.rules, pr, spotlight.equipmentType);
      const need = determineMaintenanceNeed(pr, triggered);
      const score = scoreCondition(spotlight, pr);
      spotCondition = pr.overall;
      spotScore = score.score;
    }
  }

  const spotRows = (() => {
    const hist = spotlight ? getReadings(spotlight.equipmentId) : [];
    return hist.map((r) => ({
      label: new Date(r.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      Temperature: r.temperature,
      Vibration: r.vibration
    }));
  })();

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Fleet Overview" subtitle="Real-time condition of all monitored motor equipment" actions={
        <Link to="/monitoring" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Activity className="h-4 w-4" /> Live Monitoring
        </Link>
      } />

      <div className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Equipment" value={counts.total} icon={<Cog className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Normal" value={counts.normal} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <StatCard label="Warning" value={counts.warning} icon={<TrendingUp className="h-4 w-4" />} tone="amber" />
        <StatCard label="Critical" value={counts.critical} icon={<TriangleAlert className="h-4 w-4" />} tone="red" />
        <StatCard label="Pending Reviews" value={pending.length} icon={<Wrench className="h-4 w-4" />} tone="slate" />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Fleet average — sensor trends" subtitle="Last samples across all monitored equipment">
          <TrendLineChart
            rows={trendRows}
            series={[
              { dataKey: 'Temperature', stroke: '#f97316', name: 'Temperature (°C)' },
              { dataKey: 'Vibration', stroke: '#8b5cf6', name: 'Vibration (mm/s)' },
              { dataKey: 'Voltage', stroke: '#3b82f6', name: 'Voltage (V)' },
              { dataKey: 'Motor Current', stroke: '#10b981', name: 'Current (A)' }
            ]}
            height={260}
          />
        </Card>

        <Card title="Condition distribution" subtitle="Across the fleet">
          <div className="flex min-w-0 flex-col items-center gap-3 overflow-hidden">
            <Donut
              centerLabel={String(counts.total)}
              segments={[
                { label: 'Normal', value: counts.normal, color: '#16a34a' },
                { label: 'Warning', value: counts.warning, color: '#f59e0b' },
                { label: 'Critical', value: counts.critical, color: '#dc2626' },
                { label: 'Offline', value: counts.offline, color: '#6b7280' }
              ]}
            />
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                ['Normal', counts.normal, '#16a34a'],
                ['Warning', counts.warning, '#f59e0b'],
                ['Critical', counts.critical, '#dc2626'],
                ['Offline', counts.offline, '#6b7280']
              ].map(([label, v, color]) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color as string }} />
                  {label} · {v}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Average risk by parameter" subtitle="0 (low) → 100 (critical)" bodyClassName="">
          <SimpleBarChart data={riskByParam} colorFn={riskColor} height={230} />
          <p className="mt-2 text-xs text-slate-400">Risk reflects how far each reading is from its critical threshold across the fleet.</p>
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Spotlight equipment" subtitle={spotlight ? spotlight.equipmentId + ' · ' + spotlight.name : ''}>
          {spotlight ? (
            <div className="flex flex-col items-center gap-2">
              <ConditionGauge value={spotScore} label={spotCondition === 'NORMAL' ? 'Stable' : spotCondition === 'WARNING' ? 'At risk' : 'Critical'} />
              <Link to={'/equipment/' + spotlight.equipmentId} className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                View details <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <select value={spotlightId} onChange={(e) => setSpotlightId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                {eqs.map((e) => <option key={e.id} value={e.id}>{e.equipmentId} · {e.name}</option>)}
              </select>
            </div>
          ) : <EmptyState title="No equipment" />}
        </Card>

        <Card title="Spotlight sensor trend" subtitle="Temperature & vibration">
          {spotRows.length > 1 ? (
            <TrendLineChart
              rows={spotRows}
              series={[
                { dataKey: 'Temperature', stroke: '#f97316', name: 'Temperature (°C)' },
                { dataKey: 'Vibration', stroke: '#8b5cf6', name: 'Vibration (mm/s)' }
              ]}
              height={230}
            />
          ) : <EmptyState title="No readings yet" />}
        </Card>

        <Card title="Needs attention" subtitle="Alerts requiring action">
          {eqs.filter((e) => e.status === 'CRITICAL' || e.status === 'WARNING').length === 0 && pending.length === 0 ? (
            <EmptyState title="All clear" message="No equipment currently needs attention." icon={<CheckCircle2 className="h-6 w-6" />} />
          ) : (
            <ul className="space-y-2 text-sm">
              {eqs.filter((e) => e.status === 'CRITICAL' || e.status === 'WARNING').map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ConditionBadge status={e.status} />
                    <Link to={'/equipment/' + e.equipmentId} className="truncate text-slate-700 hover:text-indigo-600">{e.equipmentId} · {e.name}</Link>
                  </div>
                </li>
              ))}
              {pending.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    <Link to="/recommendations" className="truncate text-slate-700">Recommendation pending · {r.equipmentId}</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Equipment fleet"
        subtitle="Current condition and latest reading trend"
        actions={<Link to="/equipment" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all</Link>}
        bodyClassName="!p-0"
      >
        <div className="overflow-x-auto">
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Equipment</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 font-medium">Temperature</th>
                <th className="px-3 py-2 font-medium">Vibration</th>
                <th className="px-3 py-2 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eqs.map((e) => {
                const h = getReadings(e.equipmentId).slice(-20);
                const latest = h[h.length - 1];
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={'/equipment/' + e.equipmentId} className="font-medium text-indigo-600 hover:text-indigo-700">{e.equipmentId}</Link>
                      <span className="text-slate-400"> · {e.name}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{e.location}</td>
                    <td className="px-3 py-2"><ConditionBadge status={e.status} /></td>
                    <td className="px-3 py-2 text-slate-700">{latest ? latest.temperature + ' °C' : '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{latest ? latest.vibration + ' mm/s' : '—'}</td>
                    <td className="px-3 py-2">{h.length >= 2 ? <Sparkline data={h.map((r) => r.temperature)} color="#f97316" /> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}