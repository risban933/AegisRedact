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
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;

    const dashboard = document.createElement('div');
    dashboard.className = 'dashboard';
    dashboard.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    dashboard.innerHTML = `
      <div class="dashboard-header" style="padding: 24px; border-bottom: 1px solid #e0e0e0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 24px; color: #1a1a1a;">My Files</h2>
          <button
            class="dashboard-close"
            style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 4px 8px;"
            aria-label="Close dashboard"
          >
            ×
          </button>
        </div>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">
          Encrypted files stored in your secure cloud storage
        </p>
      </div>

      <div class="dashboard-content" style="flex: 1; overflow-y: auto; padding: 24px;">
        <div class="file-list"></div>
      </div>
    `;

    overlay.appendChild(dashboard);

    // Attach event listeners
    setTimeout(() => {
      this.attachEventListeners();
      this.refresh();
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

  async refresh(): Promise<void> {
    const fileList = this.element.querySelector('.file-list') as HTMLElement;

    fileList.innerHTML = `
      <div style="text-align: center; padding: 32px; color: #666;">
        <div style="font-size: 18px; margin-bottom: 8px;">Loading...</div>
      </div>
    `;

    try {
      this.files = await this.onRefresh();
      this.renderFiles();
    } catch (error) {
      fileList.innerHTML = `
        <div style="text-align: center; padding: 32px; color: #c00;">
          <div style="font-size: 18px; margin-bottom: 8px;">⚠️ Error loading files</div>
          <div style="font-size: 14px;">${
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
        <div style="text-align: center; padding: 48px; color: #666;">
          <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
          <div style="font-size: 18px; margin-bottom: 8px;">No files yet</div>
          <div style="font-size: 14px;">Start redacting documents and save them to your cloud storage!</div>
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
        style="
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: box-shadow 0.2s;
          cursor: default;
        "
      >
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${this.escapeHtml(file.filename)}
          </div>
          <div style="font-size: 13px; color: #666; display: flex; gap: 16px;">
            <span>${this.formatBytes(file.file_size_bytes)}</span>
            <span>${this.formatDate(file.created_at)}</span>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button
            class="file-download"
            data-file-id="${file.id}"
            style="
              padding: 8px 16px;
              background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: transform 0.2s, box-shadow 0.2s;
            "
          >
            Download
          </button>
          <button
            class="file-delete"
            data-file-id="${file.id}"
            style="
              padding: 8px 16px;
              background: #dc2626;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: transform 0.2s, box-shadow 0.2s;
            "
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

    // Hover effects
    this.element.querySelectorAll('.file-item').forEach((item) => {
      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      });
      item.addEventListener('mouseleave', () => {
        (item as HTMLElement).style.boxShadow = 'none';
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
