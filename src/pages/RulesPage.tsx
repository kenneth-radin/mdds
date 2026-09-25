import React, { useState } from 'react';
import { Plus, Braces } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, Modal, Field, Button, SeverityBadge, EmptyState } from '../components/ui';
import { store } from '../services/store';
import { currentUser, canManageRules } from '../services/authService';
import { PARAM_META, PARAM_ORDER } from '../utils/params';
import { DecisionRule, RuleCond, Severity, ParameterKey, Level } from '../types';

function describeCond(c: RuleCond): string {
  switch (c.op) {
    case 'level': return `${PARAM_META[c.parameter].label} is ${c.level}`;
    case 'trend': return `${PARAM_META[c.parameter].label} ${c.direction}`;
    case 'compare': return `${PARAM_META[c.parameter].label} ${c.comparator} ${c.value}`;
    case 'always': return 'always true';
    case 'and':
    case 'or':
      return c.operands.map(describeCond).join(' ' + c.op.toUpperCase() + ' ');
  }
}

function uid(): string {
  return 'R' + Date.now().toString(36).toUpperCase();
}

function randKey(): string {
  return 'rl-' + Math.floor(Math.random() * 1e9).toString(36);
}

export default function RulesPage() {
  const state = useAppState();
  const [group, setGroup] = useState('all');
  const [edit, setEdit] = useState<DecisionRule | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', parameter: 'temperature', level: 'warning', logic: 'and', parameter2: 'current', level2: 'warning', severity: 'medium', scope: 'all', recommendation: '' });
  const [editForm, setEditForm] = useState({ severity: '', recommendation: '', enabled: true, name: '' });
  const user = currentUser();
  const canEdit = canManageRules(user);

  const rules = state.rules.filter((r) => {
    if (group === 'all') return true;
    if (group === 'single') return r.parameter !== 'multiple';
    if (group === 'combo') return r.parameter === 'multiple';
    return r.enabled;
  });

  const saveRules = (fn: (rs: DecisionRule[]) => DecisionRule[]) =>
    store.update((s) => ({ ...s, rules: fn(s.rules) }));

  const toggle = (id: string) => saveRules((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  const remove = (id: string) => saveRules((rs) => rs.filter((r) => r.id !== id));

  const openEdit = (r: DecisionRule) => {
    setEditForm({ severity: r.severity, recommendation: r.recommendation, enabled: r.enabled, name: r.name });
    setEdit(r);
  };
  const saveEdit = () => {
    if (!edit) return;
    saveRules((rs) => rs.map((r) => (r.id === edit.id ? { ...r, ...editForm, severity: editForm.severity as DecisionRule['severity'] } : r)));
    setEdit(null);
  };

  const buildCond = (): RuleCond => {
    const mk = (parameter: ParameterKey, level: Level): RuleCond => ({ op: 'level', parameter, level });
    return form.logic === 'single'
      ? mk(form.parameter as ParameterKey, form.level as Level)
      : { op: form.logic === 'and' ? 'and' : 'or', operands: [mk(form.parameter as ParameterKey, form.level as Level), mk(form.parameter2 as ParameterKey, form.level2 as Level)] };
  };

  const add = () => {
    const cond = buildCond();
    const isMulti = cond.op === 'and' || cond.op === 'or';
    const rec: DecisionRule = {
      id: uid(),
      name: form.name || (isMulti ? 'Custom combined rule' : `${PARAM_META[form.parameter as keyof typeof PARAM_META].label} ${form.level} rule`),
      description: form.description || describeCond(cond),
      parameter: isMulti ? 'multiple' : (form.parameter as DecisionRule['parameter']),
      condition: cond,
      severity: form.severity as Severity,
      scope: form.scope,
      recommendation: form.recommendation || 'Inspect the motor and schedule appropriate maintenance.',
      enabled: true,
      editable: true
    };
    saveRules((rs) => [...rs, rec]);
    setShowAdd(false);
  };

  const groups: [string, string][] = [['all', 'All'], ['single', 'Single-parameter'], ['combo', 'Combined']];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Rules Engine"
        subtitle="Configure the rule set that drives condition assessment and recommendations"
        actions={canEdit ? <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Rule</Button> : undefined}
      />

      {!canEdit && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">You have read-only access to the rules. Ask an administrator to make changes.</div>}

      <Card title={`Rules (${rules.length})`} bodyClassName="!p-0">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {groups.map(([k, l]) => <button key={k} onClick={() => setGroup(k)} className={'rounded-md px-3 py-1.5 text-sm ' + (group === k ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200')}>{l}</button>)}
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Enabled</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.id}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 max-w-md">{r.description}</td>
                  <td className="px-3 py-2"><SeverityBadge severity={r.severity} /></td>
                  <td className="px-3 py-2 text-xs text-slate-600">{r.scope}</td>
                  <td className="px-3 py-2">
                    <button type="button" disabled={!canEdit} onClick={() => toggle(r.id)}
                      className={'relative h-5 w-9 rounded-full ' + (r.enabled ? 'bg-emerald-500' : 'bg-slate-300') + (canEdit ? '' : ' opacity-60')}>
                      <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition ' + (r.enabled ? 'left-4.5' : 'left-0.5')} />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canEdit && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openEdit(r)} className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50">Edit</button>
                        <button type="button" onClick={() => { if (window.confirm('Delete rule ' + r.name + '?')) remove(r.id); }} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rules.length === 0 && <EmptyState title="No rules" />}
      </Card>

      <Modal open={!!edit} title="Edit rule" onClose={() => setEdit(null)}
        footer={<><Button onClick={() => setEdit(null)} variant="secondary">Cancel</Button><Button onClick={saveEdit}>Save</Button></>}>
        {edit && (
          <div className="space-y-3">
            <Field label="Name"><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
            <p className="text-xs text-slate-500">Condition: {describeCond(edit.condition)}</p>
            <Field label="Severity">
              <select value={editForm.severity} onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {['low', 'medium', 'high', 'critical'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Scope"><input value={edit.scope} disabled className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" /></Field>
            <Field label="Recommendation"><textarea value={editForm.recommendation} onChange={(e) => setEditForm({ ...editForm, recommendation: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.enabled} onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })} className="h-4 w-4" /> Enabled</label>
          </div>
        )}
      </Modal>

      <Modal open={showAdd} title="Add decision rule" onClose={() => setShowAdd(false)}
        footer={<><Button onClick={() => setShowAdd(false)} variant="secondary">Cancel</Button><Button onClick={add}>Add rule</Button></>}>
        <div className="space-y-3">
          <Field label="Rule name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Bearing wear alert" /></Field>
          <Field label="Condition type">
            <select value={form.logic} onChange={(e) => setForm({ ...form, logic: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="single">Single parameter / level</option>
              <option value="and">Two conditions — ALL must match (AND)</option>
              <option value="or">Two conditions — ANY matches (OR)</option>
            </select>
          </Field>
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Field label="Parameter">
              <select value={form.parameter} onChange={(e) => setForm({ ...form, parameter: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {PARAM_ORDER.map((k) => <option key={k} value={k}>{PARAM_META[k].label}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="warning">Warning</option><option value="critical">Critical</option>
              </select>
            </Field>
          </div>
          {form.logic !== 'single' && (
            <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <Field label="Second parameter">
                <select value={form.parameter2} onChange={(e) => setForm({ ...form, parameter2: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {PARAM_ORDER.map((k) => <option key={k} value={k}>{PARAM_META[k].label}</option>)}
                </select>
              </Field>
              <Field label="Second level">
                <select value={form.level2} onChange={(e) => setForm({ ...form, level2: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="warning">Warning</option><option value="critical">Critical</option>
                </select>
              </Field>
            </div>
          )}
          <Field label="Severity">
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {['low', 'medium', 'high', 'critical'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Scope">
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All equipment</option>
              <option value="Motor">Motors only</option>
            </select>
          </Field>
          <Field label="Recommendation"><textarea value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={2} /></Field>
          <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={2} /></Field>
        </div>
      </Modal>

      <Card title="How rules are applied">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Each live reading is validated and classified against the equipment thresholds (normal / warning / critical).</li>
          <li>The trend of every parameter is computed from the recent history.</li>
          <li>Enabled rules matching the equipment scope are evaluated against the readings and trends.</li>
          <li>Triggered rules drive the maintenance need and the generated recommendation — every recommendation is explainable.</li>
        </ol>
      </Card>
    </div>
  );
}