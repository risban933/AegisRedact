/**
 * Update Notification Component
 *
 * Shows a user-friendly notification when a new app version is available
 */

export class UpdateNotification {
  private element: HTMLElement;
  private onUpdate: () => void;
  private onDismiss?: () => void;

  constructor(onUpdate: () => void, onDismiss?: () => void) {
    this.onUpdate = onUpdate;
    this.onDismiss = onDismiss;
    this.element = this.createNotification();
  }

  private createNotification(): HTMLElement {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    notification.innerHTML = `
      <div class="update-content">
        <div class="update-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 7l-5-5-5 5M17 17l-5 5-5-5"/>
          </svg>
        </div>
        <div class="update-text">
          <strong class="update-title">New Version Available!</strong>
          <p class="update-description">
            An updated version of AegisRedact is ready. Update now to get the latest features and improvements.
          </p>
        </div>
        <div class="update-actions">
          <button class="update-btn-primary" data-action="update">
            <span>Update Now</span>
          </button>
          <button class="update-btn-secondary" data-action="dismiss">
            <span>Later</span>
          </button>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Attach event listeners
    const updateBtn = notification.querySelector('[data-action="update"]');
    updateBtn?.addEventListener('click', () => this.handleUpdate());

    const dismissBtn = notification.querySelector('[data-action="dismiss"]');
    dismissBtn?.addEventListener('click', () => this.handleDismiss());

    return notification;
  }

  private addStyles() {
    // Check if styles already exist
    if (document.getElementById('update-notification-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'update-notification-styles';
    style.textContent = `
      .update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 420px;
        background: linear-gradient(135deg, rgba(26, 35, 64, 0.98) 0%, rgba(31, 42, 71, 0.98) 100%);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.1);
        padding: 1.5rem;
        z-index: 10000;
        animation: slideInUp 0.4s ease-out;
      }

      @keyframes slideInUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes slideOutDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }

      .update-notification.closing {
        animation: slideOutDown 0.3s ease-in forwards;
      }

      .update-content {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
      }

      .update-icon {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #3b82f6 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
        }
        50% {
          transform: scale(1.05);
          box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
        }
      }

      .update-text {
        flex: 1;
        min-width: 0;
      }

      .update-title {
        display: block;
        font-size: 1rem;
        font-weight: 700;
        color: #e2e8f0;
        margin-bottom: 0.5rem;
      }

      .update-description {
        font-size: 0.875rem;
        line-height: 1.5;
        color: #94a3b8;
        margin: 0;
      }

      .update-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
        flex-wrap: wrap;
      }

      .update-btn-primary,
      .update-btn-secondary {
        padding: 0.625rem 1.25rem;
        border: none;
        border-radius: 10px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .update-btn-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      }

      .update-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
      }

      .update-btn-primary:active {
        transform: translateY(0);
      }

      .update-btn-secondary {
        background: rgba(100, 116, 139, 0.2);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.3);
      }

      .update-btn-secondary:hover {
        background: rgba(100, 116, 139, 0.3);
        border-color: rgba(148, 163, 184, 0.5);
      }

      @media (max-width: 640px) {
        .update-notification {
          left: 20px;
          right: 20px;
          bottom: 20px;
          max-width: none;
        }

        .update-content {
          flex-direction: column;
        }

        .update-actions {
          width: 100%;
        }

        .update-btn-primary,
        .update-btn-secondary {
          flex: 1;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private handleUpdate() {
    console.log('User clicked Update Now');

    // Show loading state
    const btn = this.element.querySelector('[data-action="update"]');
    if (btn) {
      btn.textContent = 'Updating...';
      (btn as HTMLButtonElement).disabled = true;
    }

    // Call update callback
    this.onUpdate();

    // The page will reload automatically, but just in case:
    setTimeout(() => {
      this.hide();
    }, 1000);
  }

  private handleDismiss() {
    console.log('User dismissed update notification');

    if (this.onDismiss) {
      this.onDismiss();
    }

    this.hide();
  }

  /**
   * Show the notification
   */
  show(): void {
    document.body.appendChild(this.element);

    // Announce to screen readers
    const title = this.element.querySelector('.update-title');
    if (title) {
      setTimeout(() => {
        title.setAttribute('aria-live', 'polite');
      }, 100);
    }
  }

  /**
   * Hide the notification with animation
   */
  hide(): void {
    this.element.classList.add('closing');

    setTimeout(() => {
      this.element.remove();
    }, 300);
  }

  /**
   * Get the notification element
   */
  getElement(): HTMLElement {
    return this.element;
  }
}
