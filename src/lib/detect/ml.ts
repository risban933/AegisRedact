import { pipeline, env, type Pipeline } from '@xenova/transformers';
import { filterAndEnhanceEntities } from './validation';
import { detectionCache } from './cache';
import { detectWithContext } from './context';

/**
 * ML-based PII detection using Named Entity Recognition (NER)
 * Uses Xenova/bert-base-NER model running locally in browser
 */

// Configure transformer.js environment
env.allowLocalModels = false;
env.allowRemoteModels = true;

/**
 * Entity detected by ML model
 */
export interface MLEntity {
  /** Entity text */
  text: string;
  /** Entity type (PER, ORG, LOC, MISC) */
  entity: string;
  /** Confidence score 0-1 */
  score: number;
  /** Character start position in original text */
  start: number;
  /** Character end position in original text */
  end: number;
}

/**
 * Progress callback for model loading
 */
export type ProgressCallback = (progress: {
  loaded: number;
  total: number;
  percent: number;
  status: string;
}) => void;

/**
 * Calibrated confidence thresholds per entity type
 * Tuned to balance precision and recall based on entity characteristics
 */
const CALIBRATED_THRESHOLDS: Record<string, number> = {
  'PER': 0.85,   // Person names: higher threshold (common false positives)
  'ORG': 0.75,   // Organizations: medium threshold
  'LOC': 0.70,   // Locations: lower threshold (less risky)
  'MISC': 0.90   // Miscellaneous: very high (often spurious)
};

/**
 * ML Detector class - handles NER model lifecycle
 */
export class MLDetector {
  private ner: Pipeline | null = null;
  private loading: boolean = false;
  // Switched to distilbert-NER: 40% smaller, faster, similar accuracy
  private modelName: string = 'Xenova/distilbert-NER';
  private loadPromise: Promise<void> | null = null;

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean {
    return this.ner !== null && !this.loading;
  }

  /**
   * Check if model is currently loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Load the NER model
   * @param progressCallback - Optional callback for download progress
   */
  async loadModel(progressCallback?: ProgressCallback): Promise<void> {
    if (this.ner) {
      console.log('[MLDetector] Model already loaded');
      return;
    }

    if (this.loadPromise) {
      console.log('[MLDetector] Model load already in progress, awaiting completion');
      return this.loadPromise;
    }

    this.loading = true;
    console.log(`[MLDetector] Loading model: ${this.modelName}`);

    const loadTask = (async () => {
      try {
        const startTime = performance.now();

        // Load token classification pipeline
        this.ner = await pipeline('token-classification', this.modelName, {
          progress_callback: (progress: any) => {
            if (progressCallback && progress.loaded !== undefined && progress.total !== undefined) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              progressCallback({
                loaded: progress.loaded,
                total: progress.total,
                percent,
                status: progress.status || 'Downloading model...'
              });
            }
          }
        });

        const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`[MLDetector] Model loaded successfully in ${loadTime}s`);
      } catch (error) {
        console.error('[MLDetector] Failed to load model:', error);
        throw new Error(`Failed to load ML model: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.loading = false;
        this.loadPromise = null;
      }
    })();

    this.loadPromise = loadTask;
    return loadTask;
  }

  /**
   * Detect entities in text using NER model
   * @param text - Text to analyze
   * @param minConfidence - Minimum confidence threshold (0-1), default 0.7
   * @returns Array of detected entities
   */
  async detectEntities(text: string, minConfidence: number = 0.7): Promise<MLEntity[]> {
    if (!this.ner) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      console.log(`[MLDetector] Running inference on ${text.length} characters`);
      const startTime = performance.now();

      // Run NER
      const output = await this.ner(text) as any[];

      const inferenceTime = (performance.now() - startTime).toFixed(2);
      console.log(`[MLDetector] Inference completed in ${inferenceTime}ms`);

      // Group consecutive tokens into entities
      const rawEntities = this.groupEntities(output, minConfidence);

      // Apply validation and enhancement pipeline
      const validatedEntities = filterAndEnhanceEntities(rawEntities, text);

      console.log(`[MLDetector] Found ${validatedEntities.length} entities after validation (raw: ${rawEntities.length}, filtered: ${rawEntities.length - validatedEntities.length})`);
      return validatedEntities;
    } catch (error) {
      console.error('[MLDetector] Inference error:', error);
      throw new Error(`ML detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract person names from entities
   */
  async findPersonNames(text: string, minConfidence: number = 0.8): Promise<string[]> {
    const entities = await this.detectEntities(text, minConfidence);
    return entities
      .filter(e => e.entity === 'PER')
      .map(e => e.text);
  }

  /**
   * Extract organization names from entities
   */
  async findOrganizations(text: string, minConfidence: number = 0.8): Promise<string[]> {
    const entities = await this.detectEntities(text, minConfidence);
    return entities
      .filter(e => e.entity === 'ORG')
      .map(e => e.text);
  }

  /**
   * Extract location names from entities
   */
  async findLocations(text: string, minConfidence: number = 0.8): Promise<string[]> {
    const entities = await this.detectEntities(text, minConfidence);
    return entities
      .filter(e => e.entity === 'LOC')
      .map(e => e.text);
  }

  /**
   * Batch process multiple texts in parallel
   * More efficient for multi-page documents
   * @param texts - Array of texts to process
   * @param minConfidence - Minimum confidence threshold
   * @returns Array of entity arrays (one per input text)
   */
  async detectEntitiesBatch(
    texts: string[],
    minConfidence: number = 0.7
  ): Promise<MLEntity[][]> {
    if (!this.ner) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      console.log(`[MLDetector] Batch processing ${texts.length} texts`);
      const startTime = performance.now();

      // Process all texts in parallel
      const results = await Promise.all(
        texts.map(text => this.detectEntities(text, minConfidence))
      );

      const batchTime = (performance.now() - startTime).toFixed(2);
      console.log(`[MLDetector] Batch completed in ${batchTime}ms (${(parseFloat(batchTime) / texts.length).toFixed(2)}ms per text)`);

      return results;
    } catch (error) {
      console.error('[MLDetector] Batch processing error:', error);
      throw new Error(`Batch ML detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect entities with caching
   * Automatically caches results per document/page
   * @param documentId - Unique document identifier
   * @param pageIndex - Page number
   * @param text - Text to analyze
   * @param minConfidence - Minimum confidence threshold
   * @returns Array of detected entities (from cache or fresh inference)
   */
  async detectEntitiesCached(
    documentId: string,
    pageIndex: number,
    text: string,
    minConfidence: number = 0.7
  ): Promise<MLEntity[]> {
    if (!this.ner) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    // Try to get from cache
    const cached = detectionCache.get(documentId, pageIndex, text, {
      minConfidence,
      modelName: this.modelName
    });

    if (cached !== null) {
      return cached;
    }

    // Cache miss - run detection
    console.log(`[MLDetector] Cache miss for ${documentId}:${pageIndex}, running inference`);
    const entities = await this.detectEntities(text, minConfidence);

    // Store in cache
    detectionCache.set(documentId, pageIndex, text, entities, {
      minConfidence,
      modelName: this.modelName
    });

    return entities;
  }

  /**
   * Clear cache for a specific document
   */
  clearDocumentCache(documentId: string): void {
    detectionCache.clearDocument(documentId);
  }

  /**
   * Clear all cached results
   */
  clearAllCache(): void {
    detectionCache.clearAll();
  }

  /**
   * Detect entities with context-aware windowing
   * More accurate for long documents (>500 characters)
   * Automatically uses sliding windows to prevent boundary issues
   *
   * @param text - Text to analyze
   * @param minConfidence - Minimum confidence threshold
   * @param windowSize - Window size in characters (default: 512)
   * @returns Array of detected entities with context-aware enhancements
   */
  async detectEntitiesWithContext(
    text: string,
    minConfidence: number = 0.7,
    windowSize: number = 512
  ): Promise<MLEntity[]> {
    if (!this.ner) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    if (!text || text.trim().length === 0) {
      return [];
    }

    // For short texts, use regular detection
    if (text.length <= windowSize) {
      return this.detectEntities(text, minConfidence);
    }

    // Use context-aware windowing for long texts
    return detectWithContext(
      text,
      (t, conf) => this.detectEntities(t, conf),
      minConfidence,
      windowSize
    );
  }

  /**
   * Unload the model and free resources
   */
  async unload(): Promise<void> {
    if (this.ner) {
      console.log('[MLDetector] Unloading model');
      // Transformers.js doesn't have explicit dispose, set to null for GC
      this.ner = null;
    }
  }

  /**
   * Group consecutive tokens into complete entities
   * Handles BIO tagging (B-PER, I-PER, etc.)
   * Uses calibrated thresholds per entity type
   */
  private groupEntities(output: any[], minConfidence: number): MLEntity[] {
    const grouped: MLEntity[] = [];
    let current: MLEntity | null = null;

    for (const item of output) {
      const entityType = item.entity.replace(/^[BI]-/, ''); // Remove B- or I- prefix

      // Use calibrated threshold for this entity type, fallback to global minConfidence
      const threshold = CALIBRATED_THRESHOLDS[entityType] || minConfidence;

      // Skip low confidence predictions
      if (item.score < threshold) {
        if (current) {
          grouped.push(current);
          current = null;
        }
        continue;
      }

      const isBegin = item.entity.startsWith('B-');

      if (!current || isBegin || current.entity !== entityType) {
        // Start new entity
        if (current) {
          grouped.push(current);
        }

        current = {
          entity: entityType,
          text: item.word.replace(/^##/, ''), // Remove subword prefix (##)
          score: item.score,
          start: item.start,
          end: item.end
        };
      } else {
        // Continue current entity (I- tag or same entity type)
        const word = item.word.replace(/^##/, '');

        // Add space if word doesn't start with subword marker
        if (!item.word.startsWith('##') && current.text.length > 0) {
          current.text += ' ';
        }

        current.text += word;
        current.end = item.end;
        current.score = Math.max(current.score, item.score); // Take max confidence
      }
    }

    // Add last entity
    if (current) {
      grouped.push(current);
    }

    return grouped;
  }
}

/**
 * Singleton instance for global use
 */
export const mlDetector = new MLDetector();

/**
 * Convenience function to check if ML detection is available
 */
export function isMLAvailable(): boolean {
  return mlDetector.isReady();
}

/**
 * Convenience function to load model with progress
 */
export async function loadMLModel(progressCallback?: ProgressCallback): Promise<void> {
  return mlDetector.loadModel(progressCallback);
}

/**
 * Convenience function to detect all entities
 */
export async function detectMLEntities(text: string, minConfidence?: number): Promise<MLEntity[]> {
  return mlDetector.detectEntities(text, minConfidence);
}
