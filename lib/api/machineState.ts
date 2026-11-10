import { api } from '../api';

export type MachineState = 'starting' | 'operating' | 'stopped';

export interface MachineStateLog {
  machine: string;
  state: MachineState;
  changedAt: number;   // epoch ms
  changedBy: string | null;
}

export interface CurrentMachineState {
  machine: string;
  current: {
    state: MachineState;
    changedAt: number;
    changedBy: string | null;
    ageMs: number;
  } | null;
}

export interface MachineStateHistoryResponse {
  machine: string;
  history: Array<{
    state: MachineState;
    changedAt: number;
    changedBy: string | null;
  }>;
  count: number;
}

export interface SetMachineStateResponse {
  stateLog: MachineStateLog;
  deduplicated?: boolean;
  message?: string;
}

export const machineStateApi = {
  /** GET /api/machines/:machineId/state — current/latest state (+ ageMs) */
  getCurrent: (machineId: string) =>
    api.get<CurrentMachineState>(`/api/machines/${machineId}/state`),

  /** GET /api/machines/:machineId/state/history?limit=&from=&to= — transition history */
  getHistory: (machineId: string, options?: {
    limit?: number;
    from?: number;
    to?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.from !== undefined) params.set('from', String(options.from));
    if (options?.to !== undefined) params.set('to', String(options.to));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api.get<MachineStateHistoryResponse>(
      `/api/machines/${machineId}/state/history${qs}`
    );
  },

  /** POST /api/machines/:machineId/state — create a new state log entry */
  setState: (machineId: string, state: MachineState, changedBy?: string) =>
    api.post<SetMachineStateResponse>(
      `/api/machines/${machineId}/state`,
      { state, changedBy }
    ),
};
