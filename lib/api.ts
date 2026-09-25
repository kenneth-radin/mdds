import { API_URL } from './config';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Harmless for normal servers; lets development tunnels (e.g. localtunnel)
      // forward API calls instead of returning their reminder page.
      'bypass-tunnel-reminder': 'true',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' })
};

/**
 * The API throws ApiError(status, message, payload), so ApiError.details is the
 * whole JSON body and the Zod issues live one level down in payload.details.
 * This accepts that shape as well as a bare issue array, so a rejected field is
 * named to the user instead of showing a bare "Validation failed."
 */
function describeIssues(details: unknown): string {
  const issues = Array.isArray(details)
    ? details
    : details && typeof details === 'object' && Array.isArray((details as { details?: unknown }).details)
      ? (details as { details: unknown[] }).details
      : null;
  if (!issues) return '';
  const parts: string[] = [];
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const { path, message } = issue as { path?: unknown; message?: unknown };
    if (typeof message !== 'string' || !message) continue;
    const field = Array.isArray(path) && path.length ? String(path.join('.')) : '';
    parts.push(field ? `${field}: ${message}` : message);
  }
  return parts.join('; ');
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const issues = describeIssues(error.details);
    return issues ? `${error.message} ${issues}` : error.message;
  }
  if (error instanceof Error) {
    // React Native fetch rejects with this generic text when the device cannot
    // reach the API host at all, which reads as "nothing happened" to a user.
    if (error.message === 'Network request failed') {
      return 'Cannot reach the server. Check your internet connection and try again.';
    }
    return error.message;
  }
  return 'Unexpected error. Please try again.';
}
