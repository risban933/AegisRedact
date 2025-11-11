/**
 * Share-Safe Toolkit
 * Privacy-first redaction PWA
 */

import './styles.css';
import { registerSW, setupInstallPrompt } from './lib/pwa/register-sw';
import { UpdateManager } from './lib/pwa/update-manager';
import { UpdateNotification } from './ui/components/UpdateNotification';
import { themeManager } from './lib/theme';
import { keyboardHandler, ariaAnnouncer } from './lib/a11y';
import { initApp } from './ui/App';

// Initialize theme system (loads persisted theme or syncs with system)
themeManager;

// Initialize accessibility systems
keyboardHandler;
ariaAnnouncer;

// Register service worker for PWA functionality
registerSW();

// Set up service worker update manager
new UpdateManager((applyUpdate) => {
  // Show update notification to user
  const notification = new UpdateNotification(
    () => {
      applyUpdate();
      // Page will reload automatically
    },
    () => {
      console.log('User dismissed update notification');
    }
  );

  notification.show();
});

// Set up install prompt handler
const triggerInstall = setupInstallPrompt();

// Initialize the app
const appContainer = document.getElementById('app');
if (appContainer) {
  initApp(appContainer);
}

// Expose install trigger globally for install button
(window as any).triggerInstall = triggerInstall;
