import { UserDto, ApiResponse } from '@niva/shared-types';

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
      return configured.replace(/\/$/, '');
    }
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.origin}/api/v1`;
    }
    if (configured) {
      return configured.replace(/\/$/, '');
    }
    return `${window.location.origin}/api/v1`;
  }
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
}

let currentAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export async function authFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiBase = getApiBase();
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (currentAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // sends and receives cookies
  });

  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh') && !path.includes('/auth/register')) {
    // Attempt automatic refresh
    try {
      const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const refreshData = (await refreshRes.json()) as ApiResponse<{
          tokens: { accessToken: string };
          user: UserDto;
        }>;
        if (refreshData.data?.tokens?.accessToken) {
          setAccessToken(refreshData.data.tokens.accessToken);
          headers.set('Authorization', `Bearer ${refreshData.data.tokens.accessToken}`);
          const retryRes = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          });
          const retryData = await retryRes.json();
          if (!retryRes.ok) {
            throw new Error(retryData?.error?.message || 'Request failed');
          }
          return retryData.data;
        }
      }
    } catch {
      setAccessToken(null);
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = Array.isArray(data?.error?.message)
      ? data.error.message.join(', ')
      : data?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return (data && typeof data === 'object' && 'data' in data ? data.data : data) as T;
}
