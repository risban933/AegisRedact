/**
 * ARIA Announcer
 *
 * Provides screen reader announcements using ARIA live regions.
 * Supports both polite and assertive announcements.
 */

import type { AnnouncementOptions } from './types';

export class AriaAnnouncer {
  private politeRegion: HTMLElement;
  private assertiveRegion: HTMLElement;

  constructor() {
    this.politeRegion = this.createLiveRegion('polite');
    this.assertiveRegion = this.createLiveRegion('assertive');
    this.mount();
  }

  /**
   * Create ARIA live region
   */
  private createLiveRegion(priority: 'polite' | 'assertive'): HTMLElement {
    const region = document.createElement('div');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.className = `sr-only aria-live-${priority}`;

    // Visually hidden but accessible to screen readers
    Object.assign(region.style, {
      position: 'absolute',
      left: '-10000px',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0'
    });

    return region;
  }

  /**
   * Mount live regions to DOM
   */
  private mount(): void {
    if (document.body) {
      document.body.appendChild(this.politeRegion);
      document.body.appendChild(this.assertiveRegion);
    } else {
      // Wait for DOM to be ready
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(this.politeRegion);
        document.body.appendChild(this.assertiveRegion);
      });
    }
  }

  /**
   * Announce a message to screen readers
   */
  announce(message: string, options: AnnouncementOptions = {}): void {
    const { priority = 'polite', delay = 100 } = options;

    const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion;

    // Clear previous announcement
    region.textContent = '';

    // Announce after a small delay to ensure screen readers pick it up
    setTimeout(() => {
      region.textContent = message;

      // Clear after 5 seconds to avoid clutter
      setTimeout(() => {
        region.textContent = '';
      }, 5000);
    }, delay);
  }

  /**
   * Announce file loaded
   */
  announceFileLoaded(fileName: string): void {
    this.announce(`File loaded: ${fileName}`, { priority: 'polite' });
  }

  /**
   * Announce detection complete
   */
  announceDetectionComplete(count: number): void {
    const message = count === 1
      ? '1 item detected'
      : `${count} items detected`;
    this.announce(message, { priority: 'polite' });
  }

  /**
   * Announce export complete
   */
  announceExportComplete(fileName: string): void {
    this.announce(`Export complete: ${fileName}`, { priority: 'polite' });
  }

  /**
   * Announce error
   */
  announceError(error: string): void {
    this.announce(`Error: ${error}`, { priority: 'assertive' });
  }

  /**
   * Announce redaction added
   */
  announceRedactionAdded(): void {
    this.announce('Redaction box added', { priority: 'polite' });
  }

  /**
   * Announce redaction removed
   */
  announceRedactionRemoved(): void {
    this.announce('Redaction box removed', { priority: 'polite' });
  }

  /**
   * Announce theme changed
   */
  announceThemeChanged(themeName: string): void {
    this.announce(`Theme changed to ${themeName}`, { priority: 'polite' });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.politeRegion.remove();
    this.assertiveRegion.remove();
  }
}

// Export singleton instance
export const ariaAnnouncer = new AriaAnnouncer();
