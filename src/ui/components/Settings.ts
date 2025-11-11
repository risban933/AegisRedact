import { mlDetector, type ProgressCallback } from '../../lib/detect/ml';
import { themeManager } from '../../lib/theme';
import { ariaAnnouncer } from '../../lib/a11y';

/**
 * Settings modal for ML detection configuration and theme selection
 */
export class Settings {
  private element: HTMLElement;
  private onClose: () => void;
  private onMLToggle: (enabled: boolean) => void;
  private mlEnabled: boolean = false;

  constructor(
    onClose: () => void,
    onMLToggle: (enabled: boolean) => void
  ) {
    this.onClose = onClose;
    this.onMLToggle = onMLToggle;

    // Load ML preference from localStorage
    this.mlEnabled = localStorage.getItem('ml-detection-enabled') === 'true';

    this.element = this.createModal();
    this.attachEventListeners();
    this.updateStatus();
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-container">
        <div class="settings-header">
          <h2>Detection Settings</h2>
          <button class="settings-close" aria-label="Close settings">×</button>
        </div>

        <div class="settings-content">
          <!-- Theme Selection -->
          <div class="settings-section">
            <div class="settings-section-header">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                Theme
              </h3>
            </div>

            <p class="settings-description">
              Choose your preferred color theme. Settings persist across sessions.
            </p>

            <div class="theme-selector">
              ${this.renderThemeOptions()}
            </div>
          </div>

          <!-- ML Detection Toggle -->
          <div class="settings-section">
            <div class="settings-section-header">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                  <polyline points="7.5 19.79 7.5 14.6 3 12"/>
                  <polyline points="21 12 16.5 14.6 16.5 19.79"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                Machine Learning Detection
              </h3>
              <label class="settings-toggle">
                <input type="checkbox" id="ml-enabled-toggle" ${this.mlEnabled ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <p class="settings-description">
              Use AI-powered Named Entity Recognition to detect person names, organizations, and locations. More accurate than regex patterns alone.
            </p>

            <!-- Model Status -->
            <div class="settings-model-info">
              <div class="model-status" id="model-status">
                <div class="status-indicator status-not-loaded"></div>
                <span>Model: Not Loaded</span>
              </div>

              <div class="model-details">
                <div class="model-detail">
                  <span class="detail-label">Model:</span>
                  <span class="detail-value">Xenova/bert-base-NER</span>
                </div>
                <div class="model-detail">
                  <span class="detail-label">Size:</span>
                  <span class="detail-value">~110MB</span>
                </div>
                <div class="model-detail">
                  <span class="detail-label">Cache:</span>
                  <span class="detail-value" id="cache-status">Browser Storage</span>
                </div>
              </div>

              <!-- Progress Bar (hidden by default) -->
              <div class="model-progress" id="model-progress" style="display: none;">
                <div class="progress-bar">
                  <div class="progress-fill" id="progress-fill"></div>
                </div>
                <div class="progress-text" id="progress-text">Downloading model...</div>
              </div>

              <!-- Load Model Button -->
              <button class="btn-primary" id="load-model-btn" style="display: none;">
                Load ML Model
              </button>

              <!-- Clear Cache Button -->
              <button class="btn-secondary" id="clear-cache-btn" style="display: none;">
                Clear Model Cache
              </button>
            </div>
          </div>

          <!-- Privacy Notice -->
          <div class="settings-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>All ML processing happens locally in your browser. No data is sent to external servers.</span>
          </div>
        </div>

        <div class="settings-footer">
          <button class="btn-primary" id="settings-done-btn">Done</button>
        </div>
      </div>
    `;

    return modal;
  }

  private attachEventListeners(): void {
    // Close modal
    const closeBtn = this.element.querySelector('.settings-close');
    const overlay = this.element.querySelector('.settings-overlay');
    const doneBtn = this.element.querySelector('#settings-done-btn');

    closeBtn?.addEventListener('click', () => this.close());
    overlay?.addEventListener('click', () => this.close());
    doneBtn?.addEventListener('click', () => this.close());

    // ML toggle
    const mlToggle = this.element.querySelector('#ml-enabled-toggle') as HTMLInputElement;
    mlToggle?.addEventListener('change', () => this.handleMLToggle(mlToggle.checked));

    // Load model button
    const loadBtn = this.element.querySelector('#load-model-btn');
    loadBtn?.addEventListener('click', () => this.handleLoadModel());

    // Clear cache button
    const clearBtn = this.element.querySelector('#clear-cache-btn');
    clearBtn?.addEventListener('click', () => this.handleClearCache());

    // Theme selection
    const themeButtons = this.element.querySelectorAll('.theme-option');
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const themeId = btn.getAttribute('data-theme-id');
        if (themeId) {
          this.handleThemeChange(themeId);
        }
      });
    });

    // Prevent closing when clicking inside modal
    const container = this.element.querySelector('.settings-container');
    container?.addEventListener('click', (e) => e.stopPropagation());
  }

  private renderThemeOptions(): string {
    const themes = themeManager.getAllThemes();
    const currentTheme = themeManager.getCurrentThemeId();

    return themes.map(theme => `
      <button
        class="theme-option ${theme.id === currentTheme ? 'active' : ''}"
        data-theme-id="${theme.id}"
        aria-pressed="${theme.id === currentTheme}"
      >
        <div class="theme-icon">
          ${this.getThemeIcon(theme.id)}
        </div>
        <div class="theme-info">
          <div class="theme-name">${theme.name}</div>
          <div class="theme-description">${theme.description}</div>
        </div>
      </button>
    `).join('');
  }

  private getThemeIcon(themeId: string): string {
    switch (themeId) {
      case 'dark':
        return `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        `;
      case 'light':
        return `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        `;
      case 'high-contrast':
        return `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2v20"/>
          </svg>
        `;
      default:
        return '';
    }
  }

  private handleThemeChange(themeId: string): void {
    // Update theme
    themeManager.setTheme(themeId);

    // Update UI
    const themeButtons = this.element.querySelectorAll('.theme-option');
    themeButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-theme-id') === themeId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive.toString());
    });

    // Announce to screen readers
    const theme = themeManager.getTheme(themeId);
    if (theme) {
      ariaAnnouncer.announceThemeChanged(theme.name);
    }
  }

  private handleMLToggle(enabled: boolean): void {
    this.mlEnabled = enabled;
    localStorage.setItem('ml-detection-enabled', enabled.toString());

    // Update status before calling onMLToggle to show loading state
    this.updateStatus();

    // Auto-load model if enabled and not ready
    if (enabled && !mlDetector.isReady() && !mlDetector.isLoading()) {
      console.log('[Settings] ML enabled, auto-loading model...');
      void this.handleLoadModel();
    }

    // Notify parent component after initiating load
    this.onMLToggle(enabled);
  }

  private async handleLoadModel(): Promise<void> {
    const loadBtn = this.element.querySelector('#load-model-btn') as HTMLButtonElement;
    const progressEl = this.element.querySelector('#model-progress') as HTMLElement;
    const progressFill = this.element.querySelector('#progress-fill') as HTMLElement;
    const progressText = this.element.querySelector('#progress-text') as HTMLElement;

    try {
      console.log('[Settings] Starting model load...');
      loadBtn.disabled = true;
      loadBtn.style.display = 'none';
      progressEl.style.display = 'block';

      const progressCallback: ProgressCallback = (progress) => {
        progressFill.style.width = `${progress.percent}%`;
        progressText.textContent = `Downloading model... ${progress.percent}%`;
        progressText.style.color = ''; // Reset color
      };

      await mlDetector.loadModel(progressCallback);

      console.log('[Settings] Model loaded successfully');
      progressText.textContent = 'Model loaded successfully!';
      progressText.style.color = '#4caf50';

      // Hide progress after a brief delay
      setTimeout(() => {
        progressEl.style.display = 'none';
        this.updateStatus();
      }, 1000);
    } catch (error) {
      console.error('[Settings] Failed to load model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load model';
      progressText.textContent = `Error: ${errorMessage}`;
      progressText.style.color = '#f44336';

      // Re-enable load button and disable ML toggle on error
      loadBtn.disabled = false;
      loadBtn.style.display = 'block';

      // Disable ML toggle if load fails
      const mlToggle = this.element.querySelector('#ml-enabled-toggle') as HTMLInputElement;
      if (mlToggle) {
        mlToggle.checked = false;
        this.mlEnabled = false;
        localStorage.setItem('ml-detection-enabled', 'false');
      }
    }
  }

  private async handleClearCache(): Promise<void> {
    const clearBtn = this.element.querySelector('#clear-cache-btn') as HTMLButtonElement;

    if (!confirm('Clear ML model cache? You will need to download the model again (110MB).')) {
      return;
    }

    try {
      clearBtn.disabled = true;
      clearBtn.textContent = 'Clearing...';

      // Unload model
      await mlDetector.unload();

      // Clear browser cache (transformers.js uses Cache API)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('[Settings] Found caches:', cacheNames);

        // Delete all caches (transformers.js may use various cache names)
        // This ensures complete cleanup of downloaded model files
        const deletePromises = cacheNames.map(cacheName => {
          console.log('[Settings] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        });

        await Promise.all(deletePromises);
        console.log('[Settings] All caches cleared');
      }

      clearBtn.textContent = 'Cache Cleared';
      setTimeout(() => {
        this.updateStatus();
      }, 1000);
    } catch (error) {
      console.error('[Settings] Failed to clear cache:', error);
      clearBtn.textContent = 'Error';
      clearBtn.disabled = false;
    }
  }

  private updateStatus(): void {
    const statusEl = this.element.querySelector('#model-status');
    const loadBtn = this.element.querySelector('#load-model-btn') as HTMLElement;
    const clearBtn = this.element.querySelector('#clear-cache-btn') as HTMLElement;

    if (!statusEl) return;

    const isReady = mlDetector.isReady();
    const isLoading = mlDetector.isLoading();

    if (isReady) {
      statusEl.innerHTML = `
        <div class="status-indicator status-ready"></div>
        <span>Model: Ready ✓</span>
      `;
      loadBtn.style.display = 'none';
      clearBtn.style.display = this.mlEnabled ? 'block' : 'none';
    } else if (isLoading) {
      statusEl.innerHTML = `
        <div class="status-indicator status-loading"></div>
        <span>Model: Loading...</span>
      `;
      loadBtn.style.display = 'none';
      clearBtn.style.display = 'none';
    } else {
      statusEl.innerHTML = `
        <div class="status-indicator status-not-loaded"></div>
        <span>Model: Not Loaded</span>
      `;
      loadBtn.style.display = this.mlEnabled ? 'block' : 'none';
      clearBtn.style.display = 'none';
    }
  }

  public show(): void {
    document.body.appendChild(this.element);
    this.updateStatus();

    // Focus trap
    const firstFocusable = this.element.querySelector('.settings-close') as HTMLElement;
    firstFocusable?.focus();
  }

  public close(): void {
    this.element.remove();
    this.onClose();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public isMLEnabled(): boolean {
    return this.mlEnabled;
  }
}
