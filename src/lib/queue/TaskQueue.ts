/**
 * Task Queue
 *
 * Manages batch processing of multiple files with progress tracking,
 * pause/resume, retry, and error handling.
 */

import type {
  ProcessingTask,
  TaskStatus,
  TaskQueueConfig,
  TaskProcessor,
  TaskProgressCallback,
  TaskCompleteCallback,
  TaskErrorCallback,
  QueueCompleteCallback
} from './types';
import { TaskStatus as Status } from './types';

export class TaskQueue {
  private tasks = new Map<string, ProcessingTask>();
  private processor?: TaskProcessor;
  private isProcessing = false;
  private isPaused = false;
  private maxConcurrent = 1;
  private autoStart = true;

  // Event callbacks
  onTaskStart?: (taskId: string) => void;
  onTaskProgress?: TaskProgressCallback;
  onTaskComplete?: TaskCompleteCallback;
  onTaskError?: TaskErrorCallback;
  onQueueComplete?: QueueCompleteCallback;

  constructor(config?: TaskQueueConfig) {
    if (config) {
      this.maxConcurrent = config.maxConcurrent ?? 1;
      this.autoStart = config.autoStart ?? true;
    }
  }

  /**
   * Set the task processor function
   */
  setProcessor(processor: TaskProcessor): void {
    this.processor = processor;
  }

  /**
   * Enqueue a new task
   */
  enqueue(fileIndex: number, fileName: string): string {
    const id = crypto.randomUUID();
    const task: ProcessingTask = {
      id,
      fileIndex,
      fileName,
      status: Status.PENDING,
      progress: 0
    };

    this.tasks.set(id, task);

    if (this.autoStart && !this.isPaused) {
      this.processNext();
    }

    return id;
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    this.processNext();
  }

  /**
   * Cancel a specific task
   */
  cancel(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === Status.PENDING) {
      task.status = Status.CANCELLED;
    }
  }

  /**
   * Cancel all pending tasks
   */
  cancelAll(): void {
    this.tasks.forEach(task => {
      if (task.status === Status.PENDING) {
        task.status = Status.CANCELLED;
      }
    });
    this.isPaused = true;
  }

  /**
   * Retry a failed task
   */
  retry(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === Status.FAILED) {
      task.status = Status.PENDING;
      task.error = undefined;
      task.progress = 0;
      task.startTime = undefined;
      task.endTime = undefined;

      if (!this.isPaused) {
        this.processNext();
      }
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ProcessingTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ProcessingTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): ProcessingTask[] {
    return this.getAllTasks().filter(t => t.status === status);
  }

  /**
   * Get overall queue progress (0-100)
   */
  getOverallProgress(): number {
    const tasks = this.getAllTasks();
    if (tasks.length === 0) return 0;

    const totalProgress = tasks.reduce((sum, task) => {
      if (task.status === Status.SUCCESS) return sum + 100;
      if (task.status === Status.PROCESSING) return sum + task.progress;
      return sum;
    }, 0);

    return Math.round(totalProgress / tasks.length);
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.tasks.size === 0;
  }

  /**
   * Check if queue is complete
   */
  isComplete(): boolean {
    if (this.tasks.size === 0) return false;

    return this.getAllTasks().every(task =>
      task.status === Status.SUCCESS ||
      task.status === Status.FAILED ||
      task.status === Status.CANCELLED
    );
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.isProcessing = false;
    this.isPaused = false;
  }

  /**
   * Process next task in queue
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing || this.isPaused || !this.processor) {
      return;
    }

    // Find next pending task
    const task = this.getAllTasks().find(t => t.status === Status.PENDING);

    if (!task) {
      // No more pending tasks - check if queue is complete
      if (this.isComplete() && this.tasks.size > 0) {
        this.onQueueComplete?.();
      }
      return;
    }

    // Process task
    this.isProcessing = true;
    task.status = Status.PROCESSING;
    task.startTime = Date.now();
    task.progress = 0;

    this.onTaskStart?.(task.id);

    try {
      // Call processor
      const result = await this.processor(task);

      // Mark success
      task.status = Status.SUCCESS;
      task.endTime = Date.now();
      task.result = result;
      task.progress = 100;

      this.onTaskComplete?.(task.id, result);
    } catch (error) {
      // Mark failed
      task.status = Status.FAILED;
      task.endTime = Date.now();
      task.error = error as Error;
      task.progress = 0;

      this.onTaskError?.(task.id, error as Error);
    } finally {
      this.isProcessing = false;

      // Process next task after a short delay
      setTimeout(() => this.processNext(), 100);
    }
  }

  /**
   * Update task progress manually (for long-running tasks)
   */
  updateProgress(taskId: string, progress: number): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === Status.PROCESSING) {
      task.progress = Math.max(0, Math.min(100, progress));
      this.onTaskProgress?.(taskId, task.progress);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    success: number;
    failed: number;
    cancelled: number;
  } {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === Status.PENDING).length,
      processing: tasks.filter(t => t.status === Status.PROCESSING).length,
      success: tasks.filter(t => t.status === Status.SUCCESS).length,
      failed: tasks.filter(t => t.status === Status.FAILED).length,
      cancelled: tasks.filter(t => t.status === Status.CANCELLED).length
    };
  }
}
