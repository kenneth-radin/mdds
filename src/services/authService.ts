import { User } from '../types';
import { store, saveSession, clearSession, readSession } from './store';
import { DEMO_ACCOUNT } from '../data/users';

export interface LoginResult {
  ok: boolean;
  user?: User;
  error?: string;
}

export function login(identifier: string, password: string, remember: boolean = false): LoginResult {
  const id = (identifier || '').trim().toLowerCase();
  const users = store.get().users;
  const user = users.find((u) => u.email.toLowerCase() === id || u.username.toLowerCase() === id);
  if (!user) return { ok: false, error: 'No account found for that email / username.' };
  if (user.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' };
  saveSession(user.id, remember);
  return { ok: true, user };
}

export function currentUser(): User | undefined {
  // TEMP-VISUAL-AUDIT: auto-auth as admin for screenshot review
  return store.get().users.find((u) => u.role === 'admin');
}

export function isAuthenticated(): boolean {
  return !!currentUser();
}

export function logout(): void {
  clearSession();
}

export function demoCredentials() {
  return { ...DEMO_ACCOUNT };
}

export function isAdmin(user?: User): boolean {
  return !!user && user.role === 'admin';
}

export function canManageRules(user?: User): boolean {
  return !!user && (user.role === 'admin' || user.role === 'technician');
}