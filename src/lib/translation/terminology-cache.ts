/**
 * Terminology Cache
 * Two-level caching (memory + localStorage) for RAG terminology results.
 */

import { CachedTerminology, RagTerm } from './translation-types';

const CACHE_STORAGE_KEY = 'okidoki_terminology_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_ENTRIES = 20;

// In-memory cache for fast access during translation
const memoryCache = new Map<string, CachedTerminology>();

/**
 * Generate cache key from parameters
 */
function generateCacheKey(
  industry: string,
  sourceLanguage: string,
  targetLanguage: string
): string {
  return `${industry}:${sourceLanguage}:${targetLanguage}`;
}

/**
 * Load all cached entries from localStorage into memory
 */
function loadFromStorage(): Map<string, CachedTerminology> {
  try {
    const data = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!data) return new Map();
    
    const entries = JSON.parse(data) as Record<string, CachedTerminology>;
    const now = Date.now();
    const result = new Map<string, CachedTerminology>();
    
    // Filter out expired entries
    for (const [key, value] of Object.entries(entries)) {
      if (value.expiresAt > now) {
        result.set(key, value);
      }
    }
    
    return result;
  } catch (e) {
    console.warn('[TerminologyCache] Failed to load from storage:', e);
    return new Map();
  }
}

/**
 * Save cache to localStorage
 */
function saveToStorage(cache: Map<string, CachedTerminology>): void {
  try {
    const entries: Record<string, CachedTerminology> = {};
    
    // Limit entries and convert to object
    const sortedEntries = Array.from(cache.entries())
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, MAX_CACHE_ENTRIES);
    
    for (const [key, value] of sortedEntries) {
      entries[key] = value;
    }
    
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('[TerminologyCache] Failed to save to storage:', e);
  }
}

export class TerminologyCache {
  private initialized = false;

  /**
   * Initialize cache from localStorage
   */
  private ensureInitialized(): void {
    if (this.initialized) return;
    
    const stored = loadFromStorage();
    for (const [key, value] of stored) {
      memoryCache.set(key, value);
    }
    this.initialized = true;
  }

  /**
   * Get cached terminology if available and not expired
   */
  get(
    industry: string,
    sourceLanguage: string,
    targetLanguage: string
  ): CachedTerminology | null {
    this.ensureInitialized();
    
    const key = generateCacheKey(industry, sourceLanguage, targetLanguage);
    const cached = memoryCache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (cached.expiresAt < Date.now()) {
      memoryCache.delete(key);
      saveToStorage(memoryCache);
      return null;
    }
    
    return cached;
  }

  /**
   * Store terminology in cache
   */
  set(
    industry: string,
    sourceLanguage: string,
    targetLanguage: string,
    terms: RagTerm[]
  ): void {
    this.ensureInitialized();
    
    const key = generateCacheKey(industry, sourceLanguage, targetLanguage);
    const now = Date.now();
    
    const entry: CachedTerminology = {
      terms,
      cachedAt: now,
      expiresAt: now + CACHE_TTL_MS,
      industry,
      sourceLanguage,
      targetLanguage,
    };
    
    memoryCache.set(key, entry);
    saveToStorage(memoryCache);
  }

  /**
   * Check if cache has valid entry
   */
  has(
    industry: string,
    sourceLanguage: string,
    targetLanguage: string
  ): boolean {
    return this.get(industry, sourceLanguage, targetLanguage) !== null;
  }

  /**
   * Clear specific cache entry
   */
  invalidate(
    industry: string,
    sourceLanguage: string,
    targetLanguage: string
  ): void {
    this.ensureInitialized();
    
    const key = generateCacheKey(industry, sourceLanguage, targetLanguage);
    memoryCache.delete(key);
    saveToStorage(memoryCache);
  }

  /**
   * Clear all cached entries
   */
  clearAll(): void {
    memoryCache.clear();
    try {
      localStorage.removeItem(CACHE_STORAGE_KEY);
    } catch (e) {
      console.warn('[TerminologyCache] Failed to clear storage:', e);
    }
    this.initialized = false;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    this.ensureInitialized();
    
    if (memoryCache.size === 0) {
      return { entries: 0, oldestEntry: null, newestEntry: null };
    }
    
    let oldest = Infinity;
    let newest = 0;
    
    for (const entry of memoryCache.values()) {
      if (entry.cachedAt < oldest) oldest = entry.cachedAt;
      if (entry.cachedAt > newest) newest = entry.cachedAt;
    }
    
    return {
      entries: memoryCache.size,
      oldestEntry: new Date(oldest),
      newestEntry: new Date(newest),
    };
  }
}

// Singleton instance
export const terminologyCache = new TerminologyCache();
