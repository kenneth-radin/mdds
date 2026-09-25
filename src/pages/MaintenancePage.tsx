import React, { useState } from 'react';
import { Plus, Wrench, Clock, ClipboardList } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, StatCard, Modal, Field, Button, SearchInput } from '../components/ui';
import { listMaintenance, recordMaintenance, totalDowntime } from '../services/maintenanceService';
import { listEquipment } from '../services/equipmentService';
import { fmtDate } from '../utils/params';

export default function MaintenancePage() {
  const state = useAppState();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [m, setM] = useState({ equipmentId: '', maintenanceType: 'Scheduled Inspection', problem: '', action: '', partsReplaced: 'None', technician: 'John Doe', date: new Date().toISOString().slice(0, 10), downtimeHours: '1', notes: '' });

  const equipment = listEquipment();
  let recs = listMaintenance();
  if (q) recs = recs.filter((r) => r.equipmentId.toLowerCase().includes(q.toLowerCase()));
  if (type !== 'all') recs = recs.filter((r) => r.maintenanceType === type);

  const totalDowntimeFleet = recs.reduce((a, r) => a + (r.downtimeHours || 0), 0);
  const counts = { total: listMaintenance().length, done: listMaintenance().filter((r) => r.status === 'Completed').length, open: listMaintenance().filter((r) => r.status !== 'Completed').length };

  const submit = () => {
    if (!m.equipmentId) return;
    const s = new Date(m.date + 'T08:00:00');
    recordMaintenance({
      equipmentId: m.equipmentId,
      maintenanceType: m.maintenanceType,
      problem: m.problem,
      action: m.action,
      partsReplaced: m.partsReplaced,
      technician: m.technician,
      date: m.date,
      startTime: s.toISOString(),
      endTime: new Date(s.getTime() + (Number(m.downtimeHours) || 1) * 3600000).toISOString(),
      downtimeHours: Number(m.downtimeHours) || 0,
      notes: m.notes,
      status: 'Completed',
      result: 'Completed - equipment returned to normal operation.'
    });
    setShowAdd(false);
    setM({ ...m, equipmentId: '', problem: '', action: '' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        subtitle="Maintenance register and history"
        actions={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Record Maintenance</Button>}
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Records" value={counts.total} icon={<Wrench className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Completed" value={counts.done} icon={<ClipboardList className="h-4 w-4" />} tone="green" />
        <StatCard label="Filtered downtime" value={Math.round(totalDowntimeFleet * 10) / 10 + ' h'} icon={<Clock className="h-4 w-4" />} tone="amber" />
        <StatCard label="Equipment" value={equipment.length} icon={<Wrench className="h-4 w-4" />} tone="slate" />
      </div>

      <Card title={`Maintenance records (${recs.length})`} bodyClassName="!p-0">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="w-64"><SearchInput value={q} onChange={setQ} placeholder="Search equipment id…" /></div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All types</option>
            <option>Scheduled Inspection</option><option>Preventive Maintenance</option><option>Corrective Repair</option><option>Lubrication Service</option><option>Overhaul</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Equipment</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Problem / Action</th>
                <th className="px-3 py-2 font-medium">Parts</th>
                <th className="px-3 py-2 font-medium">Technician</th>
                <th className="px-3 py-2 font-medium">Downtime</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{r.equipmentId}</td>
                  <td className="px-3 py-2 text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2">{r.maintenanceType}</td>
                  <td className="px-3 py-2 max-w-md text-slate-600">{r.problem || r.action}</td>
                  <td className="px-3 py-2 text-slate-600">{r.partsReplaced}</td>
                  <td className="px-3 py-2 text-slate-600">{r.technician}</td>
                  <td className="px-3 py-2">{r.downtimeHours} h</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showAdd} title="Record maintenance" onClose={() => setShowAdd(false)} wide
        footer={<><Button onClick={() => setShowAdd(false)} variant="secondary">Cancel</Button><Button onClick={submit}>Save record</Button></>}>
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Field label="Equipment" required>
            <select value={m.equipmentId} onChange={(e) => setM({ ...m, equipmentId: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select equipment…</option>
              {equipment.map((e) => <option key={e.id} value={e.equipmentId}>{e.equipmentId} · {e.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select value={m.maintenanceType} onChange={(e) => setM({ ...m, maintenanceType: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>Scheduled Inspection</option><option>Preventive Maintenance</option><option>Corrective Repair</option><option>Lubrication Service</option><option>Overhaul</option>
            </select>
          </Field>
          <Field label="Date"><input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Downtime (h)"><input type="number" value={m.downtimeHours} onChange={(e) => setM({ ...m, downtimeHours: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Parts replaced"><input value={m.partsReplaced} onChange={(e) => setM({ ...m, partsReplaced: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Technician"><input value={m.technician} onChange={(e) => setM({ ...m, technician: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
        </div>
        <Field label="Problem"><input value={m.problem} onChange={(e) => setM({ ...m, problem: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
        <Field label="Action taken"><textarea value={m.action} onChange={(e) => setM({ ...m, action: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} /></Field>
      </Modal>
    </div>
  );
}