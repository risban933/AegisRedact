import type { MLEntity } from './ml';

/**
 * Cache entry for detection results
 */
interface CacheEntry {
  /** Hash of the text content */
  textHash: string;
  /** Detection results */
  entities: MLEntity[];
  /** Timestamp when cached */
  timestamp: number;
  /** Detection options used (for invalidation) */
  options: {
    minConfidence: number;
    modelName: string;
  };
}

/**
 * Cache for ML detection results
 * Stores results per document and page to avoid redundant inference
 */
export class DetectionCache {
  private cache = new Map<string, CacheEntry>();
  private maxAge: number = 60 * 60 * 1000; // 1 hour default
  private maxEntries: number = 100; // Limit memory usage

  /**
   * Create a cache with optional configuration
   * @param maxAge - Maximum age of cache entries in milliseconds
   * @param maxEntries - Maximum number of entries to store
   */
  constructor(maxAge?: number, maxEntries?: number) {
    if (maxAge !== undefined) this.maxAge = maxAge;
    if (maxEntries !== undefined) this.maxEntries = maxEntries;
  }

  /**
   * Generate a cache key from document ID and page index
   */
  private generateKey(documentId: string, pageIndex: number): string {
    return `${documentId}:${pageIndex}`;
  }

  /**
   * Generate a hash of text content
   * Simple but fast hash for cache validation
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached detection results
   * @param documentId - Unique document identifier
   * @param pageIndex - Page number
   * @param text - Text content (for validation)
   * @param options - Detection options (must match for cache hit)
   * @returns Cached entities or null if not found/invalid
   */
  get(
    documentId: string,
    pageIndex: number,
    text: string,
    options: { minConfidence: number; modelName: string }
  ): MLEntity[] | null {
    const key = this.generateKey(documentId, pageIndex);
    const entry = this.cache.get(key);

    if (!entry) {
      return null; // Cache miss
    }

    // Validate cache entry
    const textHash = this.hashText(text);
    const now = Date.now();

    // Check if cache is stale
    if (now - entry.timestamp > this.maxAge) {
      console.log(`[DetectionCache] Cache expired for ${key}`);
      this.cache.delete(key);
      return null;
    }

    // Check if text content changed
    if (entry.textHash !== textHash) {
      console.log(`[DetectionCache] Text hash mismatch for ${key}`);
      this.cache.delete(key);
      return null;
    }

    // Check if options changed
    if (entry.options.minConfidence !== options.minConfidence ||
        entry.options.modelName !== options.modelName) {
      console.log(`[DetectionCache] Options changed for ${key}`);
      this.cache.delete(key);
      return null;
    }

    console.log(`[DetectionCache] Cache hit for ${key}`);
    return entry.entities;
  }

  /**
   * Store detection results in cache
   * @param documentId - Unique document identifier
   * @param pageIndex - Page number
   * @param text - Text content
   * @param entities - Detection results
   * @param options - Detection options used
   */
  set(
    documentId: string,
    pageIndex: number,
    text: string,
    entities: MLEntity[],
    options: { minConfidence: number; modelName: string }
  ): void {
    // Enforce max entries limit (LRU eviction)
    if (this.cache.size >= this.maxEntries) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        console.log(`[DetectionCache] Evicting oldest entry: ${oldestKey}`);
        this.cache.delete(oldestKey);
      }
    }

    const key = this.generateKey(documentId, pageIndex);
    const textHash = this.hashText(text);

    this.cache.set(key, {
      textHash,
      entities,
      timestamp: Date.now(),
      options
    });

    console.log(`[DetectionCache] Cached ${entities.length} entities for ${key}`);
  }

  /**
   * Clear cache for a specific document
   * @param documentId - Document to clear
   */
  clearDocument(documentId: string): void {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${documentId}:`)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    console.log(`[DetectionCache] Cleared ${cleared} entries for document ${documentId}`);
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[DetectionCache] Cleared all ${size} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    maxAge: number;
    entries: { key: string; age: number }[];
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp
    }));

    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      maxAge: this.maxAge,
      entries
    };
  }

  /**
   * Remove stale entries (older than maxAge)
   */
  prune(): void {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`[DetectionCache] Pruned ${pruned} stale entries`);
    }
  }
}

/**
 * Global detection cache instance
 */
export const detectionCache = new DetectionCache();

/**
 * Cached version of ML detection
 * Automatically checks cache before running inference
 */
export async function detectEntitiesCached(
  detector: { detectEntities: (text: string, minConfidence: number) => Promise<MLEntity[]> },
  documentId: string,
  pageIndex: number,
  text: string,
  minConfidence: number,
  modelName: string
): Promise<MLEntity[]> {
  // Try to get from cache
  const cached = detectionCache.get(documentId, pageIndex, text, {
    minConfidence,
    modelName
  });

  if (cached !== null) {
    return cached;
  }

  // Cache miss - run detection
  console.log(`[DetectionCache] Cache miss, running detection for ${documentId}:${pageIndex}`);
  const entities = await detector.detectEntities(text, minConfidence);

  // Store in cache
  detectionCache.set(documentId, pageIndex, text, entities, {
    minConfidence,
    modelName
  });

  return entities;
}
