const DEFAULT_API_BASE_URL = 'https://api.giga3.ai';

let apiBaseUrl = DEFAULT_API_BASE_URL;

export function setPlatformApiBaseUrl(url: string): void {
  apiBaseUrl = url.trim() || DEFAULT_API_BASE_URL;
}

export function getPlatformApiBaseUrl(): string {
  return apiBaseUrl;
}

export async function platformFetch(path: string, init?: RequestInit) {
  const baseUrl = getPlatformApiBaseUrl().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fetchFn = globalThis.fetch.bind(globalThis);

  return fetchFn(`${baseUrl}${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

export function isPlatformApiConfigured(): boolean {
  return apiBaseUrl !== DEFAULT_API_BASE_URL;
}