/**
 * Simple client-side cache to reduce database load
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class Cache {
  private cache: Record<string, CacheEntry<unknown>> = {};
  private defaultTTL = 60 * 1000; // 60 seconds in milliseconds

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache[key];
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      // Cache entry has expired
      delete this.cache[key];
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Optional TTL in milliseconds
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
    };

    if (ttl) {
      setTimeout(() => {
        delete this.cache[key];
      }, ttl);
    }
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache[key];
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      // Cache entry has expired
      delete this.cache[key];
      return false;
    }

    return true;
  }

  /**
   * Remove a key from the cache
   * @param key Cache key
   */
  remove(key: string): void {
    delete this.cache[key];
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache = {};
  }
}

// Export a singleton instance
export const cache = new Cache();
