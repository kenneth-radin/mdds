import { AppState, Equipment } from '../types';
import { SEED_USERS } from '../data/users';
import { SEED_RULES } from '../data/rules';
import { buildSeed } from '../data/seed';
import { processReading } from './processingService';

const KEY = 'pms.state.v1';
const SESSION_KEY = 'pms.session.v1';

type Listener = (state: AppState) => void;

function freshSeed(): AppState {
  const { equipment, readings, maintenance } = buildSeed();
  // Assess the condition of each equipment from its latest seeded reading so the
  // demo opens with the intended statuses already visible.
  const assessed = equipment.map((eq) => {
    const hist = readings.filter((r) => r.equipmentId === eq.equipmentId).sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
    if (hist.length === 0) return eq;
    const pr = processReading(eq, hist[hist.length - 1], hist.slice(0, -1));
    return { ...eq, status: pr.overall } as Equipment;
  });
  return {
    equipment: assessed,
    readings,
    maintenance,
    rules: SEED_RULES,
    recommendations: [],
    predictions: [],
    users: SEED_USERS,
    simulation: { enabled: false, intervalSeconds: 5, jitter: 0.35, speed: 1 },
    version: 1
  };
}

export class Store {
  private state: AppState;
  private listeners: Listener[] = [];

  constructor() {
    this.state = this.load();
  }

  private load(): AppState {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed && parsed.version === 1 && Array.isArray(parsed.equipment)) return parsed;
      }
    } catch {
      // fall through to seed
    }
    const seeded = freshSeed();
    try {
      localStorage.setItem(KEY, JSON.stringify(seeded));
    } catch {
      // ignore quota errors
    }
    return seeded;
  }

  get(): AppState {
    return this.state;
  }

  update(fn: (s: AppState) => AppState): AppState {
    this.state = fn(this.state);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      // ignore
    }
    this.notify();
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state);
  }

  reset(): void {
    this.state = freshSeed();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      // ignore
    }
    this.notify();
  }
}

export const store = new Store();

export function saveSession(userId: string, remember: boolean): void {
  const payload = { userId, at: new Date().toISOString(), remember };
  if (remember) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  } else {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }
}

export function readSession(): { userId: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as { userId: string };
  } catch {
    // ignore
  }
  return null;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}