/**
 * Accessibility System Types
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  handler: () => void;
}

export type FocusTrapElement = HTMLElement;

export interface AnnouncementOptions {
  priority?: 'polite' | 'assertive';
  delay?: number;
}
