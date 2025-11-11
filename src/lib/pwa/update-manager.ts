/**
 * Service Worker Update Manager
 *
 * Handles service worker updates and provides user notifications
 * when new versions are available.
 */

export class UpdateManager {
  private registration: ServiceWorkerRegistration | null = null;
  private onUpdateAvailable?: (callback: () => void) => void;

  constructor(onUpdateAvailable?: (callback: () => void) => void) {
    this.onUpdateAvailable = onUpdateAvailable;
    this.initialize();
  }

  private async initialize() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return;
    }

    try {
      // Wait for service worker to be ready
      this.registration = await navigator.serviceWorker.ready;
      console.log('Service worker ready:', this.registration);

      // Listen for updates
      this.setupUpdateListener();

      // Check for updates periodically (every hour)
      this.startPeriodicUpdateCheck();

    } catch (error) {
      console.error('Failed to initialize update manager:', error);
    }
  }

  /**
   * Setup listener for service worker updates
   */
  private setupUpdateListener() {
    if (!this.registration) return;

    // Listen for new service worker installing
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      console.log('New service worker found:', newWorker);

      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        console.log('Service worker state changed:', newWorker.state);

        // When new worker is installed and waiting
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New service worker installed and waiting');

          // New version available!
          this.handleUpdateAvailable();
        }
      });
    });

    // Listen for controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker controller changed - reloading');
      // The page will reload automatically
    });
  }

  /**
   * Handle when an update is available
   */
  private handleUpdateAvailable() {
    console.log('Update available - notifying user');

    if (this.onUpdateAvailable) {
      // Pass a callback to apply the update
      this.onUpdateAvailable(() => this.applyUpdate());
    } else {
      // Fallback: show a console message
      console.log('New version available! Reload to update.');
    }
  }

  /**
   * Apply the update by activating the waiting service worker
   */
  private applyUpdate() {
    if (!this.registration?.waiting) {
      console.warn('No waiting service worker to activate');
      return;
    }

    console.log('Applying update - sending SKIP_WAITING message');

    // Tell the waiting service worker to activate
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // The page will reload when the new SW takes control
    // due to the controllerchange event listener
  }

  /**
   * Manually check for updates
   */
  async checkForUpdate(): Promise<void> {
    if (!this.registration) {
      console.warn('No service worker registration');
      return;
    }

    try {
      console.log('Manually checking for updates...');
      await this.registration.update();
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  /**
   * Start periodic update checks (every hour)
   */
  private startPeriodicUpdateCheck() {
    // Check immediately
    setTimeout(() => this.checkForUpdate(), 5000);

    // Then check every hour
    setInterval(() => {
      console.log('Periodic update check');
      this.checkForUpdate();
    }, 60 * 60 * 1000); // 1 hour
  }
}
