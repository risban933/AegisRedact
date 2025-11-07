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

    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

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
        <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #1a1a1a;">
          ${this.mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p style="margin: 0 0 24px 0; color: #666; font-size: 14px;">
          ${
            this.mode === 'login'
              ? 'Sign in to access your secure cloud storage'
              : 'Sign up to save your redacted files securely'
          }
        </p>
      </div>

      <div class="auth-tabs" style="display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 2px solid #e0e0e0;">
        <button
          class="auth-tab ${this.mode === 'login' ? 'active' : ''}"
          data-mode="login"
          style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: ${
            this.mode === 'login' ? '#2563eb' : '#666'
          }; border-bottom: 2px solid ${
            this.mode === 'login' ? '#2563eb' : 'transparent'
          }; margin-bottom: -2px; transition: all 0.2s;"
        >
          Login
        </button>
        <button
          class="auth-tab ${this.mode === 'register' ? 'active' : ''}"
          data-mode="register"
          style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: ${
            this.mode === 'register' ? '#2563eb' : '#666'
          }; border-bottom: 2px solid ${
            this.mode === 'register' ? '#2563eb' : 'transparent'
          }; margin-bottom: -2px; transition: all 0.2s;"
        >
          Register
        </button>
      </div>

      <form class="auth-form" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; color: #333;">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
            style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 14px; transition: border-color 0.2s; box-sizing: border-box;"
          />
        </div>

        <div class="form-group">
          <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; color: #333;">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            autocomplete="${this.mode === 'login' ? 'current-password' : 'new-password'}"
            placeholder="${this.mode === 'login' ? 'Enter your password' : 'At least 12 characters'}"
            minlength="12"
            style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 14px; transition: border-color 0.2s; box-sizing: border-box;"
          />
          ${
            this.mode === 'register'
              ? '<small style="display: block; margin-top: 4px; font-size: 12px; color: #666;">Minimum 12 characters for security</small>'
              : ''
          }
        </div>

        <div class="auth-error" style="display: none; padding: 12px; background: #fee; border-radius: 6px; color: #c00; font-size: 14px;"></div>

        <button
          type="submit"
          class="auth-submit"
          style="width: 100%; padding: 14px; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);"
        >
          ${this.mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        ${
          this.mode === 'login'
            ? `
          <div style="text-align: center; margin-top: 8px;">
            <a href="#" class="forgot-password" style="color: #2563eb; font-size: 14px; text-decoration: none;">
              Forgot password?
            </a>
          </div>
        `
            : `
          <div style="font-size: 12px; color: #666; text-align: center; margin-top: 8px;">
            By creating an account, you agree to our privacy policy. All files are encrypted client-side.
          </div>
        `
        }
      </form>

      <div style="text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
        <button
          class="auth-skip"
          style="background: none; border: none; color: #666; font-size: 14px; cursor: pointer; text-decoration: underline;"
        >
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
