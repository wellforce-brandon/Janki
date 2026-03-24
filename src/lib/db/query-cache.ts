/** Simple in-memory query cache with TTL for counts that rarely change within a session */

/** Typed cache key constants for discoverability and safety */
export const CACHE_KEYS = {
	contentTypeCounts: "contentTypeCounts",
	srsSummary: "srsSummary",
} as const;

interface CacheEntry<T> {
	data: T;
	expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60_000; // 1 minute
const MAX_ENTRIES = 20;

export function getCached<T>(key: string): T | undefined {
	const entry = cache.get(key);
	if (!entry) return undefined;
	if (Date.now() > entry.expires) {
		cache.delete(key);
		return undefined;
	}
	return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
	if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
		// Evict the entry with the earliest expiry
		let oldestKey: string | null = null;
		let oldestExpires = Infinity;
		for (const [k, v] of cache) {
			if (v.expires < oldestExpires) {
				oldestExpires = v.expires;
				oldestKey = k;
			}
		}
		if (oldestKey) cache.delete(oldestKey);
	}
	cache.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateCache(key?: keyof typeof CACHE_KEYS): void {
	if (!key) {
		cache.clear();
		return;
	}
	cache.delete(key);
}
