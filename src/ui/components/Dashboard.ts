/**
 * Dashboard component for managing cloud files
 */

import type { CloudFile } from '../../lib/cloud/sync.js';
import { saveBlob } from '../../lib/fs/io.js';

export class Dashboard {
  private element: HTMLElement;
  private files: CloudFile[] = [];
  private onClose: () => void;
  private onDownload: (fileId: string) => Promise<void>;
  private onDelete: (fileId: string) => Promise<void>;
  private onRefresh: () => Promise<CloudFile[]>;

  constructor(
    onClose: () => void,
    onDownload: (fileId: string) => Promise<void>,
    onDelete: (fileId: string) => Promise<void>,
    onRefresh: () => Promise<CloudFile[]>
  ) {
    this.onClose = onClose;
    this.onDownload = onDownload;
    this.onDelete = onDelete;
    this.onRefresh = onRefresh;
    this.element = this.createElement();
  }

  private createElement(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'dashboard-overlay';

    const dashboard = document.createElement('div');
    dashboard.className = 'dashboard';

    dashboard.innerHTML = `
      <div class="dashboard-header">
        <div class="dashboard-title-row">
          <h2 class="dashboard-title">My Files</h2>
          <button class="dashboard-close" aria-label="Close dashboard">
            ×
          </button>
        </div>
        <p class="dashboard-subtitle">
          Encrypted files stored in your secure cloud storage
        </p>
      </div>

      <div class="dashboard-content">
        <div class="file-list"></div>
      </div>
    `;

    overlay.appendChild(dashboard);

    // Attach event listeners
    setTimeout(() => {
      this.attachEventListeners();
      this.loadFiles();
    }, 0);

    return overlay;
  }

  private attachEventListeners(): void {
    const closeButton = this.element.querySelector('.dashboard-close');

    closeButton?.addEventListener('click', () => {
      this.onClose();
    });

    // Close on overlay click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.onClose();
      }
    });
  }

  private async loadFiles(): Promise<void> {
    const fileList = this.element.querySelector('.file-list') as HTMLElement;

    fileList.innerHTML = `
      <div class="dashboard-status dashboard-status-loading">
        <div class="dashboard-status-title">Loading...</div>
      </div>
    `;

    try {
      this.files = await this.onRefresh();
      this.renderFiles();
    } catch (error) {
      fileList.innerHTML = `
        <div class="dashboard-status dashboard-status-error">
          <div class="dashboard-status-title">⚠️ Error loading files</div>
          <div class="dashboard-status-message">${
            error instanceof Error ? error.message : 'An error occurred'
          }</div>
        </div>
      `;
    }
  }

  private renderFiles(): void {
    const fileList = this.element.querySelector('.file-list') as HTMLElement;

    if (this.files.length === 0) {
      fileList.innerHTML = `
        <div class="dashboard-empty">
          <div class="dashboard-empty-icon">📁</div>
          <div class="dashboard-empty-title">No files yet</div>
          <div class="dashboard-empty-copy">Start redacting documents and save them to your cloud storage!</div>
        </div>
      `;
      return;
    }

    fileList.innerHTML = this.files
      .map(
        (file) => `
      <div
        class="file-item"
        data-file-id="${file.id}"
      >
        <div class="file-meta">
          <div class="file-name">
            ${this.escapeHtml(file.filename)}
          </div>
          <div class="file-stats">
            <span>${this.formatBytes(file.file_size_bytes)}</span>
            <span>${this.formatDate(file.created_at)}</span>
          </div>
        </div>

        <div class="file-actions">
          <button
            class="file-action file-download"
            data-file-id="${file.id}"
          >
            Download
          </button>
          <button
            class="file-action file-delete"
            data-file-id="${file.id}"
          >
            Delete
          </button>
        </div>
      </div>
    `
      )
      .join('');

    // Attach button listeners
    this.element.querySelectorAll('.file-download').forEach((button) => {
      button.addEventListener('click', () => {
        const fileId = (button as HTMLElement).dataset.fileId!;
        this.handleDownload(fileId);
      });
    });

    this.element.querySelectorAll('.file-delete').forEach((button) => {
      button.addEventListener('click', () => {
        const fileId = (button as HTMLElement).dataset.fileId!;
        this.handleDelete(fileId);
      });
    });
  }

  private async handleDownload(fileId: string): Promise<void> {
    const button = this.element.querySelector(
      `.file-download[data-file-id="${fileId}"]`
    ) as HTMLButtonElement;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Downloading...';

    try {
      await this.onDownload(fileId);
      button.textContent = '✓ Downloaded';
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
      }, 2000);
    } catch (error) {
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  private async handleDelete(fileId: string): Promise<void> {
    const file = this.files.find((f) => f.id === fileId);
    if (!file) return;

    const confirmed = confirm(`Delete "${file.filename}"? This cannot be undone.`);
    if (!confirmed) return;

    const button = this.element.querySelector(
      `.file-delete[data-file-id="${fileId}"]`
    ) as HTMLButtonElement;

    button.disabled = true;
    button.textContent = 'Deleting...';

    try {
      await this.onDelete(fileId);
      this.files = this.files.filter((f) => f.id !== fileId);
      this.renderFiles();
    } catch (error) {
      alert(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      button.disabled = false;
      button.textContent = 'Delete';
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  show(): void {
    document.body.appendChild(this.element);
  }

  hide(): void {
    this.element.remove();
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
