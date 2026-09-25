import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, ConditionBadge, Modal, Field, Button, SearchInput } from '../components/ui';
import { listEquipment, addEquipment, removeEquipment, toggleMonitoring } from '../services/equipmentService';
import { getLatestReading } from '../services/sensorService';

export default function EquipmentPage() {
  useAppState();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ equipmentId: '', name: '', type: '', manufacturer: '', model: '', ratedVoltage: '230', ratedCurrent: '10', location: '' });
  const [error, setError] = useState('');

  const eqs = listEquipment();
  const filtered = eqs.filter((e) =>
    (status === 'all' || e.status === status) &&
    (e.equipmentId.toLowerCase().includes(q.toLowerCase()) || e.name.toLowerCase().includes(q.toLowerCase()) || e.location.toLowerCase().includes(q.toLowerCase()))
  );

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const submit = () => {
    if (!form.equipmentId.trim() || !form.name.trim()) { setError('ID and name are required.'); return; }
    if (eqs.some((e) => e.equipmentId.toLowerCase() === form.equipmentId.trim().toLowerCase())) { setError('That equipment ID already exists.'); return; }
    addEquipment({
      equipmentId: form.equipmentId.trim(),
      name: form.name.trim(),
      type: form.type.trim() || 'Electric Motor',
      manufacturer: form.manufacturer.trim() || 'ACME Industrial',
      model: form.model.trim() || 'M-' + form.equipmentId.trim(),
      ratedVoltage: Number(form.ratedVoltage) || 230,
      ratedCurrent: Number(form.ratedCurrent) || 10,
      location: form.location.trim() || 'Unassigned'
    });
    setForm({ equipmentId: '', name: '', type: '', manufacturer: '', model: '', ratedVoltage: '230', ratedCurrent: '10', location: '' });
    setError('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment"
        subtitle="Monitored motor-based assets"
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add Equipment
          </Button>
        }
      />

      <Card title={`Assets (${filtered.length})`} bodyClassName="!p-0">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="w-64"><SearchInput value={q} onChange={setQ} placeholder="Search name / id / location…" /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All conditions</option>
            <option value="NORMAL">Normal</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Equipment</th>
                <th className="px-3 py-2 font-medium">Type / Model</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Rated</th>
                <th className="px-3 py-2 font-medium">Latest</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 font-medium">Monitoring</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => {
                const latest = getLatestReading(e.equipmentId);
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={'/equipment/' + e.equipmentId} className="font-medium text-indigo-600 hover:text-indigo-700">{e.equipmentId}</Link>
                      <span className="block text-xs text-slate-400">{e.name}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{e.type || e.equipmentType}<span className="block text-xs text-slate-400">{e.manufacturer} {e.model}</span></td>
                    <td className="px-3 py-2 text-slate-600">{e.location}</td>
                    <td className="px-3 py-2 text-slate-600">{e.ratedVoltage} V · {e.ratedCurrent} A</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{latest ? `T ${Math.round(latest.temperature)}° · I ${Math.round(latest.current)}A` : '—'}</td>
                    <td className="px-3 py-2"><ConditionBadge status={e.status} /></td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleMonitoring(e.equipmentId)}
                        title="Enable / disable monitoring"
                        className={'relative h-5 w-9 rounded-full ' + (e.monitoringEnabled ? 'bg-emerald-500' : 'bg-slate-300')}
                      >
                        <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition ' + (e.monitoringEnabled ? 'left-4.5' : 'left-0.5')} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => { if (window.confirm('Remove ' + e.equipmentId + ' and its full history?')) removeEquipment(e.equipmentId); }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={showAdd}
        title="Add equipment"
        onClose={() => setShowAdd(false)}
        footer={
          <>
            <Button onClick={() => setShowAdd(false)} variant="secondary">Cancel</Button>
            <Button onClick={submit}>Create</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Equipment ID" required>
            <input value={form.equipmentId} onChange={(e) => set('equipmentId', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="MTR-006" />
          </Field>
          <Field label="Name" required>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Motor Pump 03" />
          </Field>
          <Field label="Type">
            <input value={form.type} onChange={(e) => set('type', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Electric Motor" />
          </Field>
          <Field label="Location">
            <input value={form.location} onChange={(e) => set('location', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Process Hall" />
          </Field>
          <Field label="Manufacturer">
            <input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="ACME Industrial" />
          </Field>
          <Field label="Model">
            <input value={form.model} onChange={(e) => set('model', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Rated voltage (V)">
            <input type="number" value={form.ratedVoltage} onChange={(e) => set('ratedVoltage', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Rated current (A)">
            <input type="number" value={form.ratedCurrent} onChange={(e) => set('ratedCurrent', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}