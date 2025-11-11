/**
 * Accessibility Module
 *
 * Exports keyboard handling, focus management, and ARIA announcement utilities.
 */

export { KeyboardHandler, keyboardHandler } from './KeyboardHandler';
export { FocusManager, focusManager } from './FocusManager';
export { AriaAnnouncer, ariaAnnouncer } from './AriaAnnouncer';
export type { KeyboardShortcut, FocusTrapElement, AnnouncementOptions } from './types';
