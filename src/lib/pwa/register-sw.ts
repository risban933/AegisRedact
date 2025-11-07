/**
 * Service Worker registration for PWA functionality
 */

export function registerSW(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (import.meta.env.DEV) {
    console.info('Skipping service worker registration in development.');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}

/**
 * Handle PWA install prompt
 * Returns a function to trigger the install prompt
 */
export function setupInstallPrompt(): () => void {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing
    e.preventDefault();
    deferredPrompt = e;

    // Show your custom install button
    const installBtn = document.getElementById('install-button');
    if (installBtn) {
      installBtn.style.display = 'block';
    }
  });

  return () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
      });
    }
  };
}
