const STORAGE_KEY = 'weaver-gemini-api-key';

export function getGeminiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearGeminiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getGeminiHeaders(): HeadersInit {
  const key = getGeminiKey();
  if (!key) return {};
  return { 'x-gemini-key': key };
}
