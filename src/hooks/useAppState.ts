import { useEffect, useState } from 'react';
import { AppState } from '../types';
import { store } from '../services/store';

// Subscribe to the shared store so every mutation re-renders the UI.
export function useAppState(): AppState {
  const [state, setState] = useState<AppState>(store.get());
  useEffect(() => store.subscribe(setState), []);
  return state;
}