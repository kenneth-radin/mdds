import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Activity, Cog, CheckCircle2, Wrench, FileBarChart, Braces, Users,
  Bell, Search, LogOut, ChevronDown, Menu, X, Sun, BatteryWarning, Settings as SettingsIcon
} from 'lucide-react';
import { useAppState } from '../../hooks/useAppState';
import { store } from '../../services/store';
import { currentUser, logout } from '../../services/authService';
import { addReading } from '../../services/sensorService';
import { generateSimulatedReading } from '../../services/simulatedSource';
import { listRecommendations } from '../../services/recommendationService';

type IconType = typeof Cog;

const NAV: { to: string; label: string; icon: IconType; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/equipment', label: 'Equipment', icon: Cog },
  { to: '/monitoring', label: 'Live Monitoring', icon: Activity },
  { to: '/recommendations', label: 'Recommendations', icon: CheckCircle2 },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/reports', label: 'Reports & Analytics', icon: FileBarChart },
  { to: '/rules', label: 'Decision Rules', icon: Braces },
  { to: '/users', label: 'User Management', icon: Users },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
];

export default function AppLayout() {
  const state = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [query, setQuery] = useState('');
  const user = currentUser();

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user]);
  if (!user) return null;

  // Live simulation: when enabled, periodically ingest a sample for each monitored equipment.
  useEffect(() => {
    if (!state.simulation.enabled) return;
    const ms = Math.max(2000, state.simulation.intervalSeconds * 1000 / (state.simulation.speed || 1));
    const id = setInterval(() => {
      try {
        for (const eq of store.get().equipment) {
          if (!eq.monitoringEnabled) continue;
          const sample = generateSimulatedReading(eq);
          addReading({ ...sample, observation: 'Real-time simulated feed' });
        }
      } catch (e) {
        // ignore
      }
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.simulation.enabled, state.simulation.intervalSeconds, state.simulation.speed]);

  const critical = state.equipment.filter((e) => e.status === 'CRITICAL').length;
  const pendingRecs = listRecommendations().filter((r) => r.decision === 'pending').length;
  const notifications = critical + state.equipment.filter((e) => e.status === 'WARNING').length + pendingRecs;

  const linkCls = (isActive: boolean) =>
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ' +
    (isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800');

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-100">
      {/* Sidebar */}
      <aside className={'w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white ' + (open ? 'fixed inset-y-0 left-0 z-40 flex lg:static' : 'hidden lg:flex')}>
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <BatteryWarning className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">PMS</p>
            <p className="text-[11px] text-slate-500">Predictive Maintenance</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-md p-1 text-slate-400 lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="space-y-1 px-3 py-2">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => linkCls(isActive)}>
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mx-3 mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">About</p>
          <p className="mt-1">Rule-driven condition monitoring for motor-based equipment with explainable recommendations.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm">
          <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 text-slate-500 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to equipment…"
              className="w-full rounded-md border border-slate-200 py-1.5 pl-8 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  const m = state.equipment.find((x) => x.equipmentId.toLowerCase().includes(query.trim().toLowerCase()) || x.name.toLowerCase().includes(query.trim().toLowerCase()));
                  if (m) navigate('/equipment/' + m.equipmentId);
                  setQuery('');
                }
              }}
            />
          </div>

          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => store.update((s) => ({ ...s, simulation: { ...s.simulation, enabled: !s.simulation.enabled } }))}
              className={'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ' + (state.simulation.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}
            >
              <Sun className="h-3.5 w-3.5" />
              {state.simulation.enabled ? 'Live' : 'Live Sim'}
            </button>

            <div className="relative">
              <button type="button" onClick={() => { setShowBell(!showBell); setShowUser(false); }} className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <Bell className="h-5 w-5" />
                {notifications > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{Math.min(notifications, 99)}</span>}
              </button>
              {showBell && (
                <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="px-2 pb-1 text-xs font-semibold text-slate-500">Notifications</p>
                  {state.equipment.filter((e) => e.status === 'CRITICAL').map((e) => (
                    <div key={e.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-slate-700">{e.equipmentId} is critical</span>
                    </div>
                  ))}
                  {state.equipment.filter((e) => e.status === 'WARNING').map((e) => (
                    <div key={e.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-slate-700">{e.equipmentId} needs attention</span>
                    </div>
                  ))}
                  {pendingRecs > 0 && <div className="px-2 py-1.5 text-sm text-slate-600">{pendingRecs} recommendation(s) awaiting review</div>}
                  {notifications === 0 && <p className="px-2 py-1.5 text-sm text-slate-500">No alerts right now.</p>}
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" onClick={() => { setShowUser(!showUser); setShowBell(false); }} className="flex items-center gap-1.5 rounded-md py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {(user.name.split(' ').map((p) => p[0]).join('').slice(0, 2)).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{user.name}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showUser && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{user.role} · {user.title}</p>
                  </div>
                  <div className="border-t border-slate-200" />
                  <button type="button" onClick={() => { logout(); navigate('/login'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}