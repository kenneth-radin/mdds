import React, { useState } from 'react';
import { Plus, Users as UsersIcon, Shield } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PageHeader, Card, Modal, Field, Button, EmptyState, ConditionBadge } from '../components/ui';
import { store } from '../services/store';
import { currentUser } from '../services/authService';
import { User } from '../types';

export default function UsersPage() {
  const state = useAppState();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', role: 'technician', title: '' });
  const user = currentUser();

  if (user && user.role !== 'admin') {
    return (
      <PageHeader title="User Management" subtitle="Restricted"
        actions={<button className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300" ></button>} />
    );
  }

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const add = () => {
    if (!form.name.trim() || !form.email.trim() || !form.username.trim() || !form.password.trim()) return;
    const u: User = {
      id: 'u-' + Date.now().toString(36),
      name: form.name.trim(),
      email: form.email.trim(),
      username: form.username.trim(),
      password: form.password,   // demo only: plain text for the capstone
      role: form.role as User['role'],
      title: form.title.trim() || 'Team Member'
    };
    store.update((s) => ({ ...s, users: [...s.users, u] }));
    setShowAdd(false);
    setForm({ name: '', email: '', username: '', password: '', role: 'technician', title: '' });
  };
  const setRole = (id: string, role: User['role']) => store.update((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, role } : u)) }));
  const remove = (id: string) => store.update((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }));

  const roleStyle: Record<string, string> = { admin: 'bg-indigo-100 text-indigo-700', technician: 'bg-sky-100 text-sky-700', viewer: 'bg-slate-100 text-slate-600' };

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="Administer accounts and roles"
        actions={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add User</Button>} />

      <Card title={`Users (${state.users.length})`} bodyClassName="!p-0">
        <div className="overflow-x-auto">
          <table className="data-table min-w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500"><th className="px-3 py-2 font-medium">User</th><th className="px-3 py-2 font-medium">Username</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {state.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <div><p className="font-medium text-slate-800">{u.name}</p><p className="text-xs text-slate-400">{u.title}</p></div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{u.username}</td>
                  <td className="px-3 py-2 text-slate-600">{u.email}</td>
                  <td className="px-3 py-2">
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value as User['role'])} className={'rounded-md px-2 py-1 text-xs ' + (roleStyle[u.role] || '')}>
                      <option value="admin">Admin</option><option value="technician">Technician</option><option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { if (u.id !== user?.id && window.confirm('Remove user ' + u.username + '?')) remove(u.id); }} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showAdd} title="Add user" onClose={() => setShowAdd(false)}
        footer={<><Button onClick={() => setShowAdd(false)} variant="secondary">Cancel</Button><Button onClick={add}>Create</Button></>}>
        <div className="space-y-3">
          <Field label="Full name" required><input value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Email" required><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Username" required><input value={form.username} onChange={(e) => set('username', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Password" required><input value={form.password} onChange={(e) => set('password', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></Field>
          <Field label="Role">
            <select value={form.role} onChange={(e) => set('role', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="admin">Admin</option><option value="technician">Technician</option><option value="viewer">Viewer</option></select>
          </Field>
          <Field label="Title"><input value={form.title} onChange={(e) => set('title', e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Maintenance Technician" /></Field>
        </div>
      </Modal>
    </div>
  );
}