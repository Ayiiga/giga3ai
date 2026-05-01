/**
 * In-memory response cache with 10-minute TTL.
 * Caches AI responses keyed by hash of (systemPrompt + userPrompt).
 * Eliminates duplicate API calls when users re-submit identical prompts.
 */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 80;

type CacheEntry = {
  result: string;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

/** Fast string hash (djb2) */
function hashKey(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}

export function getCacheKey(systemPrompt: string, userPrompt: string): string {
  return hashKey(systemPrompt + '|||' + userPrompt);
}

export function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCache(key: string, result: string): void {
  // Prune expired entries if approaching limit
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.timestamp > CACHE_TTL_MS) cache.delete(k);
    }
    // If still too big, drop oldest half
    if (cache.size >= MAX_CACHE_SIZE) {
      const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDrop = Math.floor(entries.length / 2);
      for (let i = 0; i < toDrop; i++) cache.delete(entries[i][0]);
    }
  }
  cache.set(key, { result, timestamp: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}
