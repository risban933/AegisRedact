/**
 * Focus Manager
 *
 * Manages focus trapping for modals and dialogs to ensure keyboard
 * navigation stays within the active component.
 */

import type { FocusTrapElement } from './types';

export class FocusManager {
  private trapStack: FocusTrapElement[] = [];
  private previouslyFocused: HTMLElement | null = null;

  /**
   * Trap focus within an element (e.g., modal dialog)
   */
  trapFocus(element: FocusTrapElement): void {
    // Store previously focused element
    this.previouslyFocused = document.activeElement as HTMLElement;

    // Add to trap stack
    this.trapStack.push(element);

    // Setup focus trap
    this.setupTrap(element);

    // Focus first focusable element
    const firstFocusable = this.getFocusableElements(element)[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  /**
   * Release focus trap
   */
  releaseFocus(element: FocusTrapElement): void {
    // Remove from trap stack
    const index = this.trapStack.indexOf(element);
    if (index > -1) {
      this.trapStack.splice(index, 1);
    }

    // Restore focus to previously focused element
    if (this.trapStack.length === 0 && this.previouslyFocused) {
      this.previouslyFocused.focus();
      this.previouslyFocused = null;
    }
  }

  /**
   * Setup focus trap listeners
   */
  private setupTrap(element: FocusTrapElement): void {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = this.getFocusableElements(element);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: Going backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: Going forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    element.addEventListener('keydown', handleKeydown);

    // Store handler for cleanup
    (element as any).__focusTrapHandler = handleKeydown;
  }

  /**
   * Get all focusable elements within a container
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];

    // Filter out hidden elements
    return elements.filter(el => {
      return !!(
        el.offsetWidth ||
        el.offsetHeight ||
        el.getClientRects().length
      );
    });
  }

  /**
   * Check if focus is currently trapped
   */
  isTrapped(): boolean {
    return this.trapStack.length > 0;
  }

  /**
   * Get current trap element
   */
  getCurrentTrap(): FocusTrapElement | null {
    return this.trapStack.length > 0
      ? this.trapStack[this.trapStack.length - 1]
      : null;
  }

  /**
   * Release all focus traps
   */
  releaseAll(): void {
    while (this.trapStack.length > 0) {
      const element = this.trapStack.pop()!;
      const handler = (element as any).__focusTrapHandler;
      if (handler) {
        element.removeEventListener('keydown', handler);
        delete (element as any).__focusTrapHandler;
      }
    }

    if (this.previouslyFocused) {
      this.previouslyFocused.focus();
      this.previouslyFocused = null;
    }
  }
}

// Export singleton instance
export const focusManager = new FocusManager();
