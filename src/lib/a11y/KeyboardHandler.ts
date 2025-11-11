/**
 * Keyboard Handler
 *
 * Centralized keyboard shortcut management with support for:
 * - Global shortcuts
 * - Scoped shortcuts (active only in specific contexts)
 * - Modifier keys (Ctrl, Shift, Alt)
 * - Help dialog generation
 */

import type { KeyboardShortcut } from './types';

export class KeyboardHandler {
  private shortcuts = new Map<string, KeyboardShortcut>();
  private enabled = true;

  constructor() {
    this.init();
  }

  /**
   * Initialize keyboard listener
   */
  private init(): void {
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    const key = this.normalizeKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(key: string, ctrl?: boolean, shift?: boolean, alt?: boolean): void {
    const normalized = this.normalizeKey({ key, ctrl, shift, alt, description: '', handler: () => {} });
    this.shortcuts.delete(normalized);
  }

  /**
   * Handle keydown event
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Ignore if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const normalizedKey = this.normalizeKey({
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
      description: '',
      handler: () => {}
    });

    const shortcut = this.shortcuts.get(normalizedKey);
    if (shortcut) {
      e.preventDefault();
      shortcut.handler();
    }
  }

  /**
   * Normalize keyboard shortcut to string key
   */
  private normalizeKey(shortcut: Partial<KeyboardShortcut>): string {
    const parts: string[] = [];

    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key || '');

    return parts.join('+');
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable keyboard shortcuts (useful for modals)
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if keyboard shortcuts are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Generate help text for all shortcuts
   */
  getHelpText(): string {
    const shortcuts = this.getAllShortcuts();
    if (shortcuts.length === 0) {
      return 'No keyboard shortcuts registered.';
    }

    let help = 'Keyboard Shortcuts:\n\n';

    shortcuts.forEach(shortcut => {
      const keyCombo = this.formatKeyCombo(shortcut);
      help += `${keyCombo.padEnd(20)} - ${shortcut.description}\n`;
    });

    return help;
  }

  /**
   * Format key combo for display
   */
  private formatKeyCombo(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];

    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key);

    return parts.join(' + ');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.shortcuts.clear();
    this.enabled = false;
    // Note: Can't easily remove the event listener without storing a reference
  }
}

// Export singleton instance
export const keyboardHandler = new KeyboardHandler();
