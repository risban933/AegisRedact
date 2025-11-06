/**
 * Share-Safe Toolkit
 * Privacy-first redaction PWA
 */

import './styles.css';
import { registerSW, setupInstallPrompt } from './lib/pwa/register-sw';
import { initApp } from './ui/App';

// Register service worker for PWA functionality
registerSW();

// Set up install prompt handler
const triggerInstall = setupInstallPrompt();

// Initialize the app
const appContainer = document.getElementById('app');
if (appContainer) {
  initApp(appContainer);
}

// Expose install trigger globally for install button
(window as any).triggerInstall = triggerInstall;
