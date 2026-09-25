import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, Tabs, Button, EmptyState } from '../components/ui';
import { SimpleBarChart } from '../components/charts';
import {
  equipmentConditionReport, sensorTrendReport, maintenanceReport, recommendationReport, failureReport, downtimeReport
} from '../services/reportService';
import { listEquipment } from '../services/equipmentService';
import { totalDowntime } from '../services/maintenanceService';
import { toCsv, downloadCsv, downloadJson } from '../utils/export';
import { conditionHex } from '../utils/params';

export default function ReportsPage() {
  const state = useAppState();
  const [tab, setTab] = useState('condition');
  const [eqSel, setEqSel] = useState(listEquipment()[0]?.equipmentId || '');

  const condition = equipmentConditionReport();
  const trend = sensorTrendReport(eqSel);
  const maintenance = maintenanceReport();
  const recommendations = recommendationReport();
  const failures = failureReport();
  const downtime = downtimeReport();
  const downtimeData = listEquipment().map((e) => {
    const d = totalDowntime(e.equipmentId);
    return { label: e.equipmentId, value: d.hours };
  }).filter((x) => x.value > 0);

  const export_ = (name: string, ds: { headers: string[]; rows: (string | number)[][] }) => downloadCsv(name, toCsv(ds.headers, ds.rows));
  const exportJson_ = (name: string, ds: { headers: string[]; rows: (string | number)[][] }) => {
    const objects = ds.rows.map((row) => {
      const obj: Record<string, string | number> = {};
      ds.headers.forEach((h, idx) => {
        obj[h] = row[idx];
      });
      return obj;
    });
    downloadJson(name, objects);
  };

  const tabs = [
    { key: 'condition', label: 'Equipment Condition' },
    { key: 'trends', label: 'Sensor Trends' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'recommendations', label: 'Recommendations' },
    { key: 'failures', label: 'Failures' },
    { key: 'downtime', label: 'Downtime' }
  ];

  const renderTable = (ds: { headers: string[]; rows: (string | number)[][] }, empty = 'Nothing to report') => (
    <Card
      title="Report"
      subtitle={`${ds.rows.length} rows`}
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => export_(`${tab}-report.csv`, ds)} variant="secondary">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" onClick={() => exportJson_(`${tab}-report.json`, ds)} variant="secondary">
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      )}
    >
      {ds.rows.length === 0 ? <EmptyState title={empty} /> : (
        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          <table className="data-table min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50"><tr className="text-left text-xs text-slate-500">{ds.headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {ds.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 text-slate-700">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" subtitle="Exportable data views and analysis" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'condition' && renderTable(condition)}
      {tab === 'trends' && (
        <Card title="Sensor trend report" subtitle="Select an equipment">
          <select value={eqSel} onChange={(e) => setEqSel(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {listEquipment().map((e) => <option key={e.id} value={e.equipmentId}>{e.equipmentId} · {e.name}</option>)}
          </select>
          {renderTable(trend, 'No sensor data')}
        </Card>
      )}
      {tab === 'maintenance' && renderTable(maintenance, 'No maintenance records')}
      {tab === 'recommendations' && renderTable(recommendations, 'No recommendations')}
      {tab === 'failures' && renderTable(failures, 'No recorded failures')}
      {tab === 'downtime' && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Downtime by equipment (hours)" subtitle="Total logged downtime">
            {downtimeData.length ? <SimpleBarChart data={downtimeData} height={280} colorFn={() => '#f59e0b'} /> : <EmptyState title="No downtime data" />}
          </Card>
          {renderTable(downtime, 'No downtime records')}
        </div>
      )}
    </div>
  );
}