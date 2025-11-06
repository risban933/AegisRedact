import { pipeline, env, type Pipeline } from '@xenova/transformers';

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
 * ML Detector class - handles NER model lifecycle
 */
export class MLDetector {
  private ner: Pipeline | null = null;
  private loading: boolean = false;
  private modelName: string = 'Xenova/bert-base-NER';

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

    if (this.loading) {
      console.log('[MLDetector] Model already loading');
      return;
    }

    try {
      this.loading = true;
      console.log(`[MLDetector] Loading model: ${this.modelName}`);

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

      this.loading = false;
    } catch (error) {
      this.loading = false;
      console.error('[MLDetector] Failed to load model:', error);
      throw new Error(`Failed to load ML model: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      const entities = this.groupEntities(output, minConfidence);

      console.log(`[MLDetector] Found ${entities.length} entities (threshold: ${minConfidence})`);
      return entities;
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
   */
  private groupEntities(output: any[], minConfidence: number): MLEntity[] {
    const grouped: MLEntity[] = [];
    let current: MLEntity | null = null;

    for (const item of output) {
      // Skip low confidence predictions
      if (item.score < minConfidence) {
        if (current) {
          grouped.push(current);
          current = null;
        }
        continue;
      }

      const entityType = item.entity.replace(/^[BI]-/, ''); // Remove B- or I- prefix
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
