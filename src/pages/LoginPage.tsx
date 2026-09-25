import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, ShieldCheck, LockKeyhole, CheckCircle2 } from 'lucide-react';
import { login, demoCredentials } from '../services/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    setTimeout(() => {
      const res = login(identifier, password, remember);
      setBusy(false);
      if (res.ok) navigate('/', { replace: true });
      else setError(res.error || 'Login failed.');
    }, 350);
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 bg-indigo-950 lg:flex">
        <div className="flex w-full max-w-xl flex-col justify-center px-10 text-white">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold">Predictive Maintenance</h1>
              <p className="text-sm text-indigo-200">Motor condition monitoring suite</p>
            </div>
          </div>
          <p className="text-2xl font-semibold leading-snug">Catch motor problems before they cause downtime.</p>
          <p className="mt-4 text-indigo-100">Combines sensor data, decision rules and explainable recommendations to keep your line running.</p>
          <ul className="mt-8 space-y-2 text-indigo-100">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Rule-driven anomaly detection</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Live sensor simulation to demo IoT data</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Maintenance tracking & historical reports</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><Gauge className="h-5 w-5" /></span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">PMS · Predictive Maintenance System</p>
              <p className="text-[11px] text-slate-500">Sign in to the control room</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Email or Username</span>
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Remember me
            </label>
          </div>
          {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="button" onClick={submit} disabled={busy} className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs">
            <p className="font-semibold text-indigo-700">Demo accounts</p>
            <p className="mt-1 text-slate-600">Admin: <code className="text-xs">{demoCredentials().username}</code> / <code>{demoCredentials().password}</code></p>
            <p className="text-slate-500">Technician: john / tech123 · Viewer: maria / view123</p>
          </div>
        </div>
      </div>
    </div>
  );
}