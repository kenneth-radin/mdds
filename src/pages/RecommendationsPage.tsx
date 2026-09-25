import React, { useState } from 'react';
import { CheckCircle2, XCircle, PenLine, ChevronRight } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, ConditionBadge, Modal, Button, EmptyState } from '../components/ui';
import { listRecommendations, updateRecommendation } from '../services/recommendationService';
import { fmtDateTime } from '../utils/params';
import { Recommendation } from '../types';

export default function RecommendationsPage() {
  useAppState();
  const [filter, setFilter] = useState('pending');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState({ recommendedAction: '', suggestedSchedule: '', priority: '', note: '' });

  const all = listRecommendations();
  const recs = all.filter((r) => {
    const df = filter === 'all' ? true : r.decision === (filter === 'pending' ? 'pending' : filter);
    const dq = !q || r.equipmentId.toLowerCase().includes(q.toLowerCase()) || r.equipmentName.toLowerCase().includes(q.toLowerCase());
    return df && dq;
  });
  const detail = all.find((r) => r.id === selectedId) || null;

  const openDetail = (id: string) => {
    const r = all.find((x) => x.id === id);
    if (r) setEdit({ recommendedAction: r.recommendedAction, suggestedSchedule: r.suggestedSchedule, priority: r.priority, note: r.reviewNote || '' });
    setEditMode(false);
    setSelectedId(id);
  };

  const closeDetail = () => { setSelectedId(null); setEditMode(false); };
  const decide = (d: string) => {
    if (detail) updateRecommendation(detail.id, { decision: d as Recommendation['decision'] });
    closeDetail();
  };
  const saveModify = () => {
    if (!detail) return;
    updateRecommendation(detail.id, { decision: 'modified', modifiedRecommendation: edit.recommendedAction, modifiedSchedule: edit.suggestedSchedule, modifiedPriority: edit.priority, reviewNote: edit.note });
    closeDetail();
  };

  const priorityCls = (p: string) =>
    p === 'IMMEDIATE' ? 'bg-red-100 text-red-700' : p === 'HIGH' ? 'bg-orange-100 text-orange-700' : p === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700';

  const filters: [string, string][] = [['pending', 'Pending'], ['accepted', 'Accepted'], ['modified', 'Modified'], ['rejected', 'Rejected'], ['all', 'All']];

  return (
    <div className="space-y-6">
      <PageHeader title="Recommendations" subtitle="Review generated maintenance recommendations (Accept / Modify / Reject)" />

      <Card title={`Recommendations (${recs.length})`} bodyClassName="!p-0">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment…" className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 outline-none" />
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {filters.map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={'rounded-md px-3 py-1.5 text-sm ' + (filter === k ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200')}>{l}</button>
            ))}
          </div>
        </div>
        {recs.length === 0 ? <EmptyState title="No recommendations" message="Nothing matches the current filters." /> :
        <div className="overflow-x-auto">
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Equipment</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 font-medium">Need</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Recommendation</th>
                <th className="px-3 py-2 font-medium">Decision</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(r.id)}>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.equipmentId} <span className="text-xs text-slate-400">· {r.equipmentName}</span></td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmtDateTime(r.date)}</td>
                  <td className="px-3 py-2"><ConditionBadge status={r.condition} /></td>
                  <td className="px-3 py-2 text-slate-600">{r.maintenanceNeed}</td>
                  <td className="px-3 py-2"><span className={'rounded-full px-2 py-0.5 text-xs ' + priorityCls(r.priority)}>{r.priority}</span></td>
                  <td className="px-3 py-2 max-w-xs truncate text-slate-600">{r.recommendedAction}</td>
                  <td className="px-3 py-2 text-xs capitalize text-slate-500">{r.decision || 'pending'}</td>
                  <td className="px-3 py-2"><ChevronRight className="h-4 w-4 text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </Card>

      <Modal open={!!detail} title={detail ? 'Recommendation · ' + detail.equipmentId : ''} onClose={closeDetail} wide>
        {detail && !editMode && (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">Generated {fmtDateTime(detail.date)} · Condition <ConditionBadge status={detail.condition} /> · {detail.maintenanceNeed}</p>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold text-indigo-700">Recommended action</p>
              <p className="mt-1 text-slate-800">{detail.recommendedAction}</p>
            </div>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Possible problem</dt><dd className="text-slate-700">{detail.possibleProblem}</dd></div>
              <div><dt className="text-xs text-slate-500">Suggested schedule</dt><dd className="text-slate-700">{detail.suggestedSchedule}</dd></div>
              <div><dt className="text-xs text-slate-500">Suggested inspection</dt><dd className="text-slate-700">{detail.suggestedInspection}</dd></div>
              <div><dt className="text-xs text-slate-500">Affected parameters</dt><dd className="text-slate-700">{detail.affectedParameters.join(', ') || '—'}</dd></div>
            </dl>
            <p className="text-xs text-slate-500">Reason: {detail.reason}</p>
            {detail.triggeredRules.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                <p className="font-semibold text-slate-600">Why this recommendation</p>
                {detail.triggeredRules.map((t) => <p key={t.ruleId} className="pl-2 text-slate-600">• {t.name} ({t.severity}) — {t.explanation}</p>)}
              </div>
              
            )}
          </div>
        )}
        {detail && editMode && (
          <div className="space-y-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Revised action</span>
              <textarea value={edit.recommendedAction} onChange={(e) => setEdit({ ...edit, recommendedAction: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Suggested schedule</span>
              <input value={edit.suggestedSchedule} onChange={(e) => setEdit({ ...edit, suggestedSchedule: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Priority</span>
              <select value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {['IMMEDIATE', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p}>{p}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Review note</span>
              <textarea value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows={2} /></label>
          </div>
        )}
        {detail && (
          <div className="flex flex-wrap items-center gap-2">
            {!editMode ? (
              <>
                <Button onClick={() => decide(('accepted'))}><CheckCircle2 className="h-4 w-4" /> Accept</Button>
                <Button onClick={() => setEditMode(true)} variant="secondary"><PenLine className="h-4 w-4" /> Modify</Button>
                <Button onClick={() => decide('rejected')} variant="danger"><XCircle className="h-4 w-4" /> Reject</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditMode(false)} variant="secondary">Cancel</Button>
                <Button onClick={saveModify}>Save changes</Button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}