/**
 * Toast notification component
 */

export class Toast {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  show(message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} glass-card`;

    // Add icon based on type
    const icon = this.getIcon(type);

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" aria-label="Close notification">×</button>
    `;

    this.container.appendChild(toast);

    // Close button functionality
    const closeBtn = toast.querySelector('.toast-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => {
      this.removeToast(toast);
    });

    // Animate in with bounce
    setTimeout(() => toast.classList.add('toast-show'), 10);

    // Remove after duration
    const timeoutId = setTimeout(() => {
      this.removeToast(toast);
    }, duration);

    // Clear timeout if manually closed
    closeBtn.addEventListener('click', () => clearTimeout(timeoutId), { once: true });
  }

  private removeToast(toast: HTMLElement) {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 400);
  }

  private getIcon(type: 'info' | 'success' | 'error'): string {
    switch (type) {
      case 'success':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>`;
      case 'error':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`;
      case 'info':
      default:
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>`;
    }
  }

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }
}
