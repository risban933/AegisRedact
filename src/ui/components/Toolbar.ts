/**
 * Toolbar component with detection toggles and actions
 */

export interface ToolbarOptions {
  findEmails: boolean;
  findPhones: boolean;
  findSSNs: boolean;
  findCards: boolean;
  findDates: boolean;
  findAddresses: boolean;
  useOCR: boolean;
}

export class Toolbar {
  private element: HTMLDivElement;
  private options: ToolbarOptions;
  private onChange: (options: ToolbarOptions) => void;
  private onExport: () => void;
  private onReset: () => void;
  private onNewFile: () => void;
  private onSettings: () => void;
  private onShowAuth: (() => void) | null = null;
  private onShowDashboard: (() => void) | null = null;
  private onBatchExport: (() => void) | null = null;

  constructor(
    onChange: (options: ToolbarOptions) => void,
    onExport: () => void,
    onReset: () => void,
    onNewFile: () => void,
    onSettings: () => void,
    onShowAuth?: () => void,
    onShowDashboard?: () => void,
    onBatchExport?: () => void
  ) {
    this.options = {
      findEmails: true,
      findPhones: true,
      findSSNs: true,
      findCards: true,
      findDates: true,
      findAddresses: true,
      useOCR: false
    };
    this.onChange = onChange;
    this.onExport = onExport;
    this.onReset = onReset;
    this.onNewFile = onNewFile;
    this.onSettings = onSettings;
    this.onShowAuth = onShowAuth || null;
    this.onShowDashboard = onShowDashboard || null;
    this.onBatchExport = onBatchExport || null;
    this.element = this.createToolbar();
  }

  private createToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    toolbar.innerHTML = `
      <div class="toolbar-section">
        <button id="btn-export" class="btn btn-primary" disabled aria-label="Export redacted document">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Export Redacted</span>
        </button>
        <button id="btn-batch-export" class="btn btn-primary" disabled aria-label="Export all files in batch" style="display: none;">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
            <path d="M14 4h4v4"/>
          </svg>
          <span>Batch Export All</span>
        </button>
        <button id="btn-new-file" class="btn btn-secondary" style="display: none;" aria-label="Start with a new file">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>New File</span>
        </button>
        <button id="btn-reset" class="btn btn-secondary" aria-label="Load new files">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          <span>Load New Files</span>
        </button>
      </div>
      <div class="toolbar-section">
        <h3 style="font-size: 0.875rem; margin: 0 0 0.5rem 0; color: var(--text-secondary);">Detection</h3>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-emails" checked aria-label="Detect email addresses">
          <span>Emails</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-phones" checked aria-label="Detect phone numbers">
          <span>Phone Numbers</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-ssns" checked aria-label="Detect Social Security Numbers">
          <span>SSNs</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-cards" checked aria-label="Detect credit card numbers">
          <span>Credit Cards</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-dates" checked aria-label="Detect dates and birthdays">
          <span>Dates & Birthdays</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-addresses" checked aria-label="Detect addresses">
          <span>Addresses</span>
        </label>
        <label class="toolbar-checkbox" title="Enable OCR for scanned documents and images">
          <input type="checkbox" id="use-ocr" aria-label="Enable OCR for scanned documents">
          <span>Use OCR (scanned docs)</span>
        </label>
      </div>
      <div class="toolbar-section" style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color);">
        <button id="btn-settings" class="btn btn-secondary" aria-label="Detection settings">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
          </svg>
          <span>Settings</span>
        </button>
      </div>
      <div class="toolbar-auth" style="margin-top: 16px;">
        <div class="auth-container"></div>
      </div>
    `;

    // Wire up event listeners
    const checkboxes = ['emails', 'phones', 'ssns', 'cards', 'dates', 'addresses', 'ocr'];
    checkboxes.forEach((name) => {
      const checkbox = toolbar.querySelector(`#find-${name}`) as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.updateOptions();
          this.onChange(this.options);
        });
      }
    });

    toolbar.querySelector('#btn-export')?.addEventListener('click', () => {
      this.onExport();
    });

    toolbar.querySelector('#btn-batch-export')?.addEventListener('click', () => {
      this.onBatchExport?.();
    });

    toolbar.querySelector('#btn-new-file')?.addEventListener('click', () => {
      this.onNewFile();
    });

    toolbar.querySelector('#btn-reset')?.addEventListener('click', () => {
      this.onReset();
    });

    toolbar.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.onSettings();
    });

    return toolbar;
  }

  private updateOptions() {
    this.options.findEmails = (this.element.querySelector('#find-emails') as HTMLInputElement)?.checked || false;
    this.options.findPhones = (this.element.querySelector('#find-phones') as HTMLInputElement)?.checked || false;
    this.options.findSSNs = (this.element.querySelector('#find-ssns') as HTMLInputElement)?.checked || false;
    this.options.findCards = (this.element.querySelector('#find-cards') as HTMLInputElement)?.checked || false;
    this.options.findDates = (this.element.querySelector('#find-dates') as HTMLInputElement)?.checked || false;
    this.options.findAddresses = (this.element.querySelector('#find-addresses') as HTMLInputElement)?.checked || false;
    this.options.useOCR = (this.element.querySelector('#use-ocr') as HTMLInputElement)?.checked || false;
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  getOptions(): ToolbarOptions {
    return this.options;
  }

  enableExport(enabled: boolean) {
    const btn = this.element.querySelector('#btn-export') as HTMLButtonElement;
    if (btn) {
      btn.disabled = !enabled;
    }
  }

  enableBatchExport(enabled: boolean, fileCount: number = 0) {
    const btn = this.element.querySelector('#btn-batch-export') as HTMLButtonElement;
    if (btn) {
      // Show button only when multiple files are loaded
      btn.style.display = fileCount > 1 ? 'inline-flex' : 'none';
      btn.disabled = !enabled || fileCount < 2;
    }
  }

  showNewFileButton(show: boolean) {
    const newFileBtn = this.element.querySelector('#btn-new-file') as HTMLButtonElement;
    if (newFileBtn) {
      newFileBtn.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Show login button for unauthenticated users
   */
  showLoginButton(): void {
    const container = this.element.querySelector('.auth-container');
    if (container) {
      container.innerHTML = `
        <button class="login-button" style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, var(--primary-color), #667eea); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s;" aria-label="Sign in to cloud storage">
          <svg style="width: 18px; height: 18px; vertical-align: middle; margin-right: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span style="vertical-align: middle;">Sign In</span>
        </button>
      `;
      const button = container.querySelector('.login-button') as HTMLButtonElement;
      button?.addEventListener('click', () => this.onShowAuth?.());
      button?.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      });
      button?.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = 'none';
      });
    }
  }

  /**
   * Show user menu for authenticated users
   */
  showUserMenu(userMenuElement: HTMLElement): void {
    const container = this.element.querySelector('.auth-container');
    if (container) {
      container.innerHTML = '';
      container.appendChild(userMenuElement);
    }
  }

  focusAuthTrigger(): void {
    const container = this.element.querySelector('.auth-container');
    const trigger = container?.querySelector(
      '.user-menu-button, .login-button'
    ) as HTMLButtonElement | null;

    trigger?.focus();
  }
}
