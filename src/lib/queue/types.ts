/**
 * Task Queue Types
 *
 * Defines types for batch processing task management.
 */

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

export interface ProcessingTask {
  id: string;
  fileIndex: number;
  fileName: string;
  status: TaskStatus;
  progress: number; // 0-100
  error?: Error;
  startTime?: number;
  endTime?: number;
  result?: Blob;
}

export interface TaskQueueConfig {
  maxConcurrent?: number; // Default: 1 (sequential)
  autoStart?: boolean; // Default: true
}

export type TaskProcessor = (task: ProcessingTask) => Promise<Blob>;
export type TaskProgressCallback = (taskId: string, progress: number) => void;
export type TaskCompleteCallback = (taskId: string, result: Blob) => void;
export type TaskErrorCallback = (taskId: string, error: Error) => void;
export type QueueCompleteCallback = () => void;
