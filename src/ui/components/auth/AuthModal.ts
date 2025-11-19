/**
 * Authentication modal component
 * Login and registration UI
 */

export type AuthMode = 'login' | 'register';

export class AuthModal {
  private element: HTMLElement;
  private mode: AuthMode = 'login';
  private onClose: () => void;
  private onLogin: (email: string, password: string) => Promise<void>;
  private onRegister: (email: string, password: string) => Promise<void>;

  constructor(
    onClose: () => void,
    onLogin: (email: string, password: string) => Promise<void>,
    onRegister: (email: string, password: string) => Promise<void>
  ) {
    this.onClose = onClose;
    this.onLogin = onLogin;
    this.onRegister = onRegister;
    this.element = this.createElement();
  }

  private createElement(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'auth-modal';

    modal.innerHTML = this.getModalContent();
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.onClose();
      }
    });

    // Attach event listeners
    setTimeout(() => this.attachEventListeners(), 0);

    return overlay;
  }

  private getModalContent(): string {
    return `
      <div class="auth-modal-header">
        <h2 class="auth-title">
          ${this.mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p class="auth-subtitle">
          ${
            this.mode === 'login'
              ? 'Sign in to access your secure cloud storage'
              : 'Sign up to save your redacted files securely'
          }
        </p>
      </div>

      <div class="auth-tabs">
        <button
          class="auth-tab ${this.mode === 'login' ? 'active' : ''}"
          data-mode="login"
        >
          Login
        </button>
        <button
          class="auth-tab ${this.mode === 'register' ? 'active' : ''}"
          data-mode="register"
        >
          Register
        </button>
      </div>

      <form class="auth-form">
        <div class="form-group">
          <label class="auth-label">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
            class="auth-input"
          />
        </div>

        <div class="form-group">
          <label class="auth-label">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            autocomplete="${this.mode === 'login' ? 'current-password' : 'new-password'}"
            placeholder="${this.mode === 'login' ? 'Enter your password' : 'At least 12 characters'}"
            minlength="12"
            class="auth-input"
          />
          ${
            this.mode === 'register'
              ? '<small class="auth-password-hint">Minimum 12 characters for security</small>'
              : ''
          }
        </div>

        <div class="auth-error"></div>

        <button
          type="submit"
          class="auth-submit"
        >
          ${this.mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        ${
          this.mode === 'login'
            ? `
          <div class="auth-footnote">
            <a href="#" class="forgot-password">
              Forgot password?
            </a>
          </div>
        `
            : `
          <div class="auth-footnote auth-footnote-muted">
            By creating an account, you agree to our privacy policy. All files are encrypted client-side.
          </div>
        `
        }
      </form>

      <div class="auth-footer">
        <button class="auth-skip">
          Continue without account
        </button>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const form = this.element.querySelector('.auth-form') as HTMLFormElement;
    const tabs = this.element.querySelectorAll('.auth-tab');
    const skipButton = this.element.querySelector('.auth-skip');
    const submitButton = this.element.querySelector('.auth-submit') as HTMLButtonElement;

    // Tab switching
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = (tab as HTMLElement).dataset.mode as AuthMode;
        this.setMode(mode);
      });
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      this.clearError();
      submitButton.disabled = true;
      submitButton.textContent = this.mode === 'login' ? 'Signing in...' : 'Creating account...';

      try {
        if (this.mode === 'login') {
          await this.onLogin(email, password);
        } else {
          await this.onRegister(email, password);
        }
      } catch (error) {
        this.showError(error instanceof Error ? error.message : 'An error occurred');
        submitButton.disabled = false;
        submitButton.textContent = this.mode === 'login' ? 'Sign In' : 'Create Account';
      }
    });

    // Skip button
    skipButton?.addEventListener('click', () => {
      this.onClose();
    });
  }

  private setMode(mode: AuthMode): void {
    this.mode = mode;
    const modal = this.element.querySelector('.auth-modal');
    if (modal) {
      modal.innerHTML = this.getModalContent();
      this.attachEventListeners();
    }
  }

  private showError(message: string): void {
    const errorEl = this.element.querySelector('.auth-error') as HTMLElement;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  private clearError(): void {
    const errorEl = this.element.querySelector('.auth-error') as HTMLElement;
    if (errorEl) {
      errorEl.style.display = 'none';
    }
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
