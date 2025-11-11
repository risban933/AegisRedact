/**
 * Batch Progress Panel
 *
 * Displays progress for batch file processing with controls for
 * pause/resume/cancel and retry failed tasks.
 */

import type { ProcessingTask } from '../../lib/queue';
import { TaskStatus } from '../../lib/queue';

export class BatchProgressPanel {
  private element: HTMLElement;
  private taskCards = new Map<string, HTMLElement>();
  private isPaused = false;

  // Event callbacks
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: (taskId: string) => void;
  onDownloadAll?: () => void;
  onClose?: () => void;

  constructor() {
    this.element = this.createPanel();
    this.attachEventListeners();
  }

  /**
   * Create the panel HTML structure
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'batch-progress-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>Batch Processing</h3>
        <button class="panel-close" aria-label="Close panel">×</button>
      </div>

      <div class="overall-progress">
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="progress-fill" id="overall-progress-fill"></div>
          </div>
        </div>
        <div class="progress-stats">
          <span class="progress-text" id="overall-progress-text">0 / 0 files</span>
        </div>
      </div>

      <div class="task-list" id="task-list"></div>

      <div class="panel-actions">
        <button class="btn-secondary" id="pause-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
          Pause
        </button>
        <button class="btn-secondary" id="resume-btn" disabled style="display: none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Resume
        </button>
        <button class="btn-secondary" id="cancel-btn">
          Cancel All
        </button>
        <button class="btn-primary" id="download-all-btn" disabled>
          Download All
        </button>
      </div>
    `;

    return panel;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const pauseBtn = this.element.querySelector('#pause-btn') as HTMLButtonElement;
    const resumeBtn = this.element.querySelector('#resume-btn') as HTMLButtonElement;
    const cancelBtn = this.element.querySelector('#cancel-btn') as HTMLButtonElement;
    const downloadBtn = this.element.querySelector('#download-all-btn') as HTMLButtonElement;
    const closeBtn = this.element.querySelector('.panel-close') as HTMLButtonElement;

    pauseBtn?.addEventListener('click', () => {
      this.isPaused = true;
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'inline-flex';
      resumeBtn.disabled = false;
      this.onPause?.();
    });

    resumeBtn?.addEventListener('click', () => {
      this.isPaused = false;
      resumeBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
      this.onResume?.();
    });

    cancelBtn?.addEventListener('click', () => {
      if (confirm('Cancel all pending tasks?')) {
        this.onCancel?.();
      }
    });

    downloadBtn?.addEventListener('click', () => {
      this.onDownloadAll?.();
    });

    closeBtn?.addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });
  }

  /**
   * Add a new task card
   */
  addTask(task: ProcessingTask): void {
    const taskList = this.element.querySelector('#task-list');
    if (!taskList) return;

    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    card.innerHTML = `
      <div class="task-header">
        <div class="task-info">
          <span class="task-icon">
            ${this.getStatusIcon(task.status)}
          </span>
          <span class="task-name">${this.escapeHtml(task.fileName)}</span>
        </div>
        <span class="status-badge ${task.status}">${this.formatStatus(task.status)}</span>
      </div>
      <div class="task-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${task.progress}%"></div>
        </div>
        <span class="progress-percent">${task.progress}%</span>
      </div>
      <div class="task-actions">
        <button class="btn-icon retry-btn" data-task-id="${task.id}" disabled title="Retry">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>
    `;

    taskList.appendChild(card);
    this.taskCards.set(task.id, card);

    // Attach retry button listener
    const retryBtn = card.querySelector('.retry-btn');
    retryBtn?.addEventListener('click', () => {
      this.onRetry?.(task.id);
    });
  }

  /**
   * Update task status and progress
   */
  updateTask(task: ProcessingTask): void {
    const card = this.taskCards.get(task.id);
    if (!card) return;

    // Update status badge
    const statusBadge = card.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = this.formatStatus(task.status);
      statusBadge.className = `status-badge ${task.status}`;
    }

    // Update progress bar
    const progressFill = card.querySelector('.progress-fill') as HTMLElement;
    const progressPercent = card.querySelector('.progress-percent');
    if (progressFill) {
      progressFill.style.width = `${task.progress}%`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${task.progress}%`;
    }

    // Update icon
    const taskIcon = card.querySelector('.task-icon');
    if (taskIcon) {
      taskIcon.innerHTML = this.getStatusIcon(task.status);
    }

    // Update retry button
    const retryBtn = card.querySelector('.retry-btn') as HTMLButtonElement;
    if (retryBtn) {
      retryBtn.disabled = task.status !== TaskStatus.FAILED;
    }

    // Update overall progress
    this.updateOverallProgress();
  }

  /**
   * Update overall progress bar
   */
  private updateOverallProgress(): void {
    const tasks = Array.from(this.taskCards.keys());
    const completed = tasks.filter(id => {
      const card = this.taskCards.get(id);
      const status = card?.querySelector('.status-badge')?.textContent?.toLowerCase();
      return status === 'success';
    }).length;

    const progressFill = this.element.querySelector('#overall-progress-fill') as HTMLElement;
    const progressText = this.element.querySelector('#overall-progress-text');
    const downloadBtn = this.element.querySelector('#download-all-btn') as HTMLButtonElement;

    if (progressFill && progressText) {
      const percentage = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `${completed} / ${tasks.length} files`;
    }

    // Enable download button when all complete
    if (downloadBtn) {
      downloadBtn.disabled = completed !== tasks.length || tasks.length === 0;
    }
  }

  /**
   * Get status icon HTML
   */
  private getStatusIcon(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.PENDING:
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>`;
      case TaskStatus.PROCESSING:
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
        </svg>`;
      case TaskStatus.SUCCESS:
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>`;
      case TaskStatus.FAILED:
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`;
      case TaskStatus.CANCELLED:
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`;
      default:
        return '';
    }
  }

  /**
   * Format status text
   */
  private formatStatus(status: TaskStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show panel
   */
  show(): void {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
    // Trigger reflow for animation
    void this.element.offsetHeight;
    this.element.classList.add('visible');
  }

  /**
   * Hide panel
   */
  hide(): void {
    this.element.classList.remove('visible');
    setTimeout(() => {
      this.element.remove();
    }, 300);
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    const taskList = this.element.querySelector('#task-list');
    if (taskList) {
      taskList.innerHTML = '';
    }
    this.taskCards.clear();
    this.updateOverallProgress();
  }

  /**
   * Get element
   */
  getElement(): HTMLElement {
    return this.element;
  }
}
