import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Gauge } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, ConditionBadge, Tabs, Modal, Field, Button, LevelBadge, SeverityBadge } from '../components/ui';
import { ConditionGauge, TrendLineChart } from '../components/charts';
import { getEquipment, updateEquipment, toggleMonitoring } from '../services/equipmentService';
import { getReadings, addReading, getLatestReading } from '../services/sensorService';
import { processReading } from '../services/processingService';
import { evaluateRules } from '../rules/engine';
import { determineMaintenanceNeed, conditionSummary } from '../services/conditionService';
import { scoreCondition, generatePrediction } from '../services/predictiveService';
import { PARAM_META, fmtDateTime, fmtDate } from '../utils/params';
import { forEquipment, recordMaintenance } from '../services/maintenanceService';
import { listRecommendations } from '../services/recommendationService';
import { EmptyState } from '../components/ui';

export default function EquipmentDetailPage() {
  const state = useAppState();
  const { id } = useParams();
  const eq = getEquipment(id || '');
  const [tab, setTab] = useState('overview');
  const [showReading, setShowReading] = useState(false);
  const [showMaint, setShowMaint] = useState(false);
  const [showThresh, setShowThresh] = useState(false);
  const [reading, setReading] = useState({ temperature: '60', vibration: '2.0', voltage: '220', current: '9', observation: '' });
  const [maint, setMaint] = useState({ maintenanceType: 'Scheduled Inspection', problem: '', action: '', partsReplaced: 'None', technician: 'John Doe', date: new Date().toISOString().slice(0, 10), downtimeHours: '1', notes: '' });
  const [threshEdit, setThreshEdit] = useState<any>(null);

  if (!eq) return <EmptyState title="Equipment not found" message="It may have been removed." action={<Link to="/equipment" className="text-sm font-medium text-indigo-600">Back to equipment</Link>} />;

  const history = getReadings(eq.equipmentId);
  const latest = history[history.length - 1];
  const breakdown = latest ? processReading(eq, latest, history.slice(0, -1)) : null;
  const triggered = breakdown ? evaluateRules(state.rules, breakdown, eq.equipmentType) : [];
  const need = breakdown ? determineMaintenanceNeed(breakdown, triggered) : null;
  const score = breakdown ? scoreCondition(eq, breakdown) : null;
  const prediction = breakdown && need && score ? generatePrediction(eq, breakdown, need, score) : null;
  const maintenance = forEquipment(eq.equipmentId);
  const recs = listRecommendations().filter((r) => r.equipmentId === eq.equipmentId);

  const trendRows = history.map((r) => ({
    label: fmtDateTime(r.timestamp).slice(5),
    Temperature: r.temperature,
    Vibration: r.vibration,
    Voltage: r.voltage,
    'Motor Current': r.current
  }));

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'trends', label: 'Sensor Trends' },
    { key: 'history', label: 'History', count: history.length },
    { key: 'diagnostics', label: 'Diagnostics' },
    { key: 'maintenance', label: 'Maintenance', count: maintenance.length },
    { key: 'thresholds', label: 'Thresholds' }
  ];

  const submitReading = () => {
    addReading({
      equipmentId: eq.equipmentId,
      temperature: Number(reading.temperature) || 0,
      vibration: Number(reading.vibration) || 0,
      voltage: Number(reading.voltage) || 0,
      current: Number(reading.current) || 0,
      observation: reading.observation
    });
    setShowReading(false);
    setReading({ temperature: '60', vibration: '2.0', voltage: '220', current: '9', observation: '' });
  };

  const submitMaint = () => {
    const s = new Date(maint.date + 'T08:00:00');
    const e = new Date(s.getTime() + (Number(maint.downtimeHours) || 1) * 3600000);
    recordMaintenance({
      equipmentId: eq.equipmentId,
      maintenanceType: maint.maintenanceType,
      problem: maint.problem,
      action: maint.action,
      partsReplaced: maint.partsReplaced,
      technician: maint.technician,
      date: maint.date,
      startTime: s.toISOString(),
      endTime: e.toISOString(),
      downtimeHours: Number(maint.downtimeHours) || 0,
      notes: maint.notes,
      status: 'Completed',
      result: 'Completed - equipment returned to normal operation.'
    });
    setShowMaint(false);
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={`${eq.equipmentId} · ${eq.name}`}
        subtitle={`${eq.type} — ${eq.location}`}
        actions={
          <>
            <Link to="/equipment" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
            <Button onClick={() => setShowReading(true)} variant="secondary"><Plus className="h-4 w-4" /> Add Reading</Button>
            <Button onClick={() => setShowMaint(true)}>
              <Plus className="h-4 w-4" /> Record Maintenance
            </Button>
          </>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Condition" subtitle="Assessed from latest sensors">
          {score && latest ? (
            <div className="flex flex-col items-center gap-2">
              <ConditionGauge value={score.score} label={score.label} />
              <ConditionBadge status={breakdown!.overall} />
            </div>
          ) : <EmptyState title="No readings yet" message="Add a reading to assess condition." icon={<Gauge className="h-6 w-6" />} />}
        </Card>
        <Card title="Maintenance need" subtitle={need ? need.label : ''}>
          {need ? (
            <div className="min-w-0 text-sm text-slate-700">
              <p className="mb-1 break-words">{need.reason}</p>
              <p className="mt-1 break-words text-xs text-indigo-600">Priority: {need.priority} · Recommendation: {prediction ? prediction.text : ''}</p>
            </div>
          ) : <EmptyState title="No assessment" />}
        </Card>
        <Card title="Latest sensor values" subtitle={latest ? fmtDateTime(latest.timestamp) : ''}>
          {latest ? (
            <ul className="space-y-1.5 text-sm">
              {(['temperature', 'vibration', 'voltage', 'current'] as const).map((k) => (
                <li key={k} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 break-words text-slate-600">{PARAM_META[k].label}</span>
                  <span className="inline-flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 text-right font-medium text-slate-800">{latest[k] + ' ' + PARAM_META[k].unit} <LevelBadge level={breakdown!.params[k].level} /></span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No readings" />}
        </Card>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Key readings" subtitle="Latest vs limits" bodyClassName="!p-0">
            {latest && breakdown ? (
              <div className="overflow-x-auto p-4">
              <table className="data-table min-w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Reading</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Risk</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(['temperature', 'vibration', 'voltage', 'current'] as const).map((k) => (
                    <tr key={k}>
                      <td className="px-3 py-2">{PARAM_META[k].label}</td>
                      <td className="px-3 py-2">{latest[k]} {PARAM_META[k].unit}</td>
                      <td className="px-3 py-2"><LevelBadge level={breakdown.params[k].level} /></td>
                      <td className="px-3 py-2 text-slate-700">{score ? score.risks.find((r) => r.parameter === k)?.riskPercent.toFixed(0) + '%' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : <EmptyState title="No data" />}
          </Card>
          <Card title="Summary" subtitle="Explainable assessment">
            {breakdown ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p className="font-medium text-slate-800">{conditionSummary(breakdown)}</p>
                <ul className="list-disc space-y-1 pl-5">
                  {breakdown.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                {latest && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    {breakdown.validations.join('; ')}
                  </div>
                )}
              </div>
            ) : <EmptyState title="No data" />}
          </Card>
        </div>
      )}

      {tab === 'trends' && (
        <Card title="Sensor trends" subtitle="Temperature, vibration, voltage and motor current">
          {trendRows.length > 1 ? (
            <TrendLineChart
              rows={trendRows}
              height={360}
              series={[
                { dataKey: 'Temperature', stroke: '#f97316', name: 'Temperature (°C)' },
                { dataKey: 'Vibration', stroke: '#8b5cf6', name: 'Vibration (mm/s)' },
                { dataKey: 'Voltage', stroke: '#3b82f6', name: 'Voltage (V)' },
                { dataKey: 'Motor Current', stroke: '#10b981', name: 'Current (A)' }
              ]}
            />
          ) : <EmptyState title="Not enough history yet" />}
        </Card>
      )}

      {tab === 'history' && (
        <Card title={`Sensor history (${history.length})`} bodyClassName="!p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="px-3 py-2">Time</th><th className="px-3 py-2">Temp (°C)</th><th className="px-3 py-2">Vib (mm/s)</th><th className="px-3 py-2">V (V)</th><th className="px-3 py-2">I (A)</th><th className="px-3 py-2">Op hours</th><th className="px-3 py-2">Source</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.slice().reverse().map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-slate-600">{fmtDateTime(r.timestamp)}</td>
                    <td className="px-3 py-2">{r.temperature}</td>
                    <td className="px-3 py-2">{r.vibration}</td>
                    <td className="px-3 py-2">{r.voltage}</td>
                    <td className="px-3 py-2">{r.current}</td>
                    <td className="px-3 py-2 text-slate-600">{r.operatingHours}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'diagnostics' && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Triggered decision rules" subtitle="Why this condition was raised">
            {triggered.length ? (
              <ul className="space-y-3">
                {triggered.map((t) => (
                  <li key={t.ruleId} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between"><span className="font-medium text-slate-800">{t.name}</span> <SeverityBadge severity={t.severity} /></div>
                    <p className="mt-1 text-xs text-slate-500">{t.explanation}</p>
                    <p className="mt-1 text-xs text-indigo-600 italic">→ {t.recommendation}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No rules triggered" message="Reading is within acceptable limits." />}
          </Card>
          <Card title="Prediction" subtitle="Trend-based outlook">
            {prediction ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">{prediction.text}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {prediction.detail.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
                {prediction.daysEstimate !== null && (
                  <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">Estimated maintenance window: ~{prediction.daysEstimate} day(s).</p>
                )}
              </div>
            ) : <EmptyState title="No prediction yet" />}
          </Card>
        </div>
      )}

      {tab === 'maintenance' && (
        <Card
          title="Maintenance history"
          actions={<Button size="sm" onClick={() => setShowMaint(true)}><Plus className="h-3.5 w-3.5" /> Record</Button>}
          bodyClassName="!p-0"
        >
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Parts</th><th className="px-3 py-2">Technician</th><th className="px-3 py-2">Downtime</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {maintenance.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(m.date)}</td>
                    <td className="px-3 py-2">{m.maintenanceType}</td>
                    <td className="px-3 py-2 text-slate-600">{m.action}</td>
                    <td className="px-3 py-2 text-slate-600">{m.partsReplaced}</td>
                    <td className="px-3 py-2 text-slate-600">{m.technician}</td>
                    <td className="px-3 py-2">{m.downtimeHours} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'thresholds' && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {(['temperature', 'vibration', 'voltage', 'current'] as const).map((k) => (
            <Card key={k} title={`${PARAM_META[k].label} thresholds`} subtitle={eq.thresholds[k].relative ? 'Relative to rated current' : 'Absolute values'} bodyClassName="!p-0">
              <div className="overflow-x-auto p-4">
              <table className="data-table min-w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="px-3 py-2">Band</th><th className="px-3 py-2">Range</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(['normal', 'warning', 'critical'] as const).map((lv) => (
                    <tr key={lv}>
                      <td className="px-3 py-2"><LevelBadge level={lv} /></td>
                      <td className="px-3 py-2 text-slate-700">
                        {eq.thresholds[k].bands[lv].map((e) => {
                          const unit = eq.thresholds[k].relative ? eq.thresholds[k].unit : eq.thresholds[k].unit;
                          const m = (v: number | null) => (v === null ? '∞' : eq.thresholds[k].relative ? `${Math.round(v as number * 100) / 100}× rated` : `${v} ${unit}`);
                          return `${e.min === null ? '≤' : '≥'} ${m(e.min)} — ${e.max === null ? 'open' : m(e.max)}`;
                        }).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add reading modal */}
      <Modal open={showReading} title="Add a manual sensor reading" onClose={() => setShowReading(false)}
        footer={<><Button onClick={() => setShowReading(false)} variant="secondary">Cancel</Button><Button onClick={submitReading}>Add</Button></>}>
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Field label="Temperature (°C)"><input type="number" value={reading.temperature} onChange={(e) => setReading({ ...reading, temperature: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Vibration (mm/s)"><input type="number" value={reading.vibration} onChange={(e) => setReading({ ...reading, vibration: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Voltage (V)"><input type="number" value={reading.voltage} onChange={(e) => setReading({ ...reading, voltage: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Motor current (A)"><input type="number" value={reading.current} onChange={(e) => setReading({ ...reading, current: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
        </div>
        <Field label="Observation" hint="Optional note"><textarea value={reading.observation} onChange={(e) => setReading({ ...reading, observation: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={2} /></Field>
      </Modal>

      {/* Record maintenance modal */}
      <Modal open={showMaint} title="Record maintenance" onClose={() => setShowMaint(false)}
        footer={<><Button onClick={() => setShowMaint(false)} variant="secondary">Cancel</Button><Button onClick={submitMaint}>Save</Button></>} wide>
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Field label="Type" required>
            <select value={maint.maintenanceType} onChange={(e) => setMaint({ ...maint, maintenanceType: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>Scheduled Inspection</option><option>Preventive Maintenance</option><option>Corrective Repair</option><option>Lubrication Service</option><option>Overhaul</option>
            </select>
          </Field>
          <Field label="Date"><input type="date" value={maint.date} onChange={(e) => setMaint({ ...maint, date: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Technician"><input value={maint.technician} onChange={(e) => setMaint({ ...maint, technician: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Downtime (h)"><input type="number" value={maint.downtimeHours} onChange={(e) => setMaint({ ...maint, downtimeHours: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Problem"><input value={maint.problem} onChange={(e) => setMaint({ ...maint, problem: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Parts replaced"><input value={maint.partsReplaced} onChange={(e) => setMaint({ ...maint, partsReplaced: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
        </div>
        <Field label="Action taken"><textarea value={maint.action} onChange={(e) => setMaint({ ...maint, action: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} /></Field>
        <Field label="Notes"><textarea value={maint.notes} onChange={(e) => setMaint({ ...maint, notes: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={2} /></Field>
      </Modal>
    </div>
  );
}