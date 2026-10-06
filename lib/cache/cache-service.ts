import Redis from "ioredis";

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string | string[]): Promise<void>;
  increment(key: string, windowSeconds: number): Promise<number>;
  clear(): Promise<void>;
}

interface MemoryCacheEntry {
  value: unknown;
  expiresAt: number | null;
}

export class MemoryCacheAdapter implements CacheStore {
  private cache = new Map<string, MemoryCacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      this.cache.delete(k);
    }
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const cacheKey = `ratelimit:${key}:${windowStart}`;

    const entry = this.cache.get(cacheKey);
    let currentCount = 1;

    if (entry && (entry.expiresAt === null || now <= entry.expiresAt)) {
      currentCount = (entry.value as number) + 1;
    }

    const expiresAt = windowStart + windowMs + 5000; // retain 5s beyond window
    this.cache.set(cacheKey, { value: currentCount, expiresAt });
    return currentCount;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

export class RedisCacheAdapter implements CacheStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });

    this.redis.on("error", (err) => {
      console.error("[CacheService] Redis error:", err.message);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[CacheService] Redis get failed for key ${key}:`, err);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, payload, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, payload);
      }
    } catch (err) {
      console.warn(`[CacheService] Redis set failed for key ${key}:`, err);
    }
  }

  async del(key: string | string[]): Promise<void> {
    try {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      console.warn(`[CacheService] Redis del failed:`, err);
    }
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const cacheKey = `ratelimit:${key}:${windowStart}`;

    try {
      const count = await this.redis.incr(cacheKey);
      if (count === 1) {
        // Set expiry on key creation (window length + small buffer)
        await this.redis.expire(cacheKey, windowSeconds + 5);
      }
      return count;
    } catch (err) {
      console.warn(`[CacheService] Redis increment failed:`, err);
      return 1;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (err) {
      console.warn(`[CacheService] Redis clear failed:`, err);
    }
  }
}

class UnifiedCacheService implements CacheStore {
  private primaryAdapter: CacheStore;
  private memoryFallbackAdapter: MemoryCacheAdapter;
  private isUsingRedis: boolean = false;

  constructor() {
    this.memoryFallbackAdapter = new MemoryCacheAdapter();
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      try {
        this.primaryAdapter = new RedisCacheAdapter(redisUrl);
        this.isUsingRedis = true;
      } catch (err) {
        console.error("[CacheService] Failed to initialize Redis, falling back to memory:", err);
        this.primaryAdapter = this.memoryFallbackAdapter;
      }
    } else {
      this.primaryAdapter = this.memoryFallbackAdapter;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.primaryAdapter.get<T>(key);
      if (val !== null) return val;
      return await this.memoryFallbackAdapter.get<T>(key);
    } catch {
      return await this.memoryFallbackAdapter.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.memoryFallbackAdapter.set(key, value, ttlSeconds);
    if (this.isUsingRedis) {
      try {
        await this.primaryAdapter.set(key, value, ttlSeconds);
      } catch {
        // Ignored, memory fallback set
      }
    }
  }

  async del(key: string | string[]): Promise<void> {
    await this.memoryFallbackAdapter.del(key);
    if (this.isUsingRedis) {
      try {
        await this.primaryAdapter.del(key);
      } catch {
        // Ignored
      }
    }
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    if (this.isUsingRedis) {
      try {
        return await this.primaryAdapter.increment(key, windowSeconds);
      } catch {
        return await this.memoryFallbackAdapter.increment(key, windowSeconds);
      }
    }
    return await this.memoryFallbackAdapter.increment(key, windowSeconds);
  }

  async clear(): Promise<void> {
    await this.memoryFallbackAdapter.clear();
    if (this.isUsingRedis) {
      try {
        await this.primaryAdapter.clear();
      } catch {
        // Ignored
      }
    }
  }
}

export const cacheService = new UnifiedCacheService();
