/**
 * Theme Manager
 *
 * Centralized theme management system that handles:
 * - Runtime theme switching
 * - localStorage persistence
 * - System preference synchronization (prefers-color-scheme, prefers-contrast)
 * - Event emission for theme changes
 */

import type { Theme, ThemeConfig, ThemeChangeListener } from './types';
import { DEFAULT_THEMES } from './themes';

export class ThemeManager {
  private themes = new Map<string, Theme>();
  private currentThemeId: string = 'dark';
  private listeners = new Set<ThemeChangeListener>();
  private storageKey = 'app-theme';

  private config: ThemeConfig = {
    defaultTheme: 'dark',
    syncWithSystem: true,
    persistChoice: true
  };

  constructor(config?: Partial<ThemeConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.registerDefaultThemes();
    this.initialize();
  }

  /**
   * Initialize theme system
   */
  private initialize(): void {
    // Load persisted theme or sync with system
    const savedTheme = this.loadThemeFromStorage();

    if (savedTheme && this.themes.has(savedTheme)) {
      this.setTheme(savedTheme);
    } else if (this.config.syncWithSystem) {
      this.syncWithSystemPreference();
    } else {
      this.setTheme(this.config.defaultTheme);
    }

    // Listen for system preference changes
    if (this.config.syncWithSystem) {
      this.watchSystemPreferences();
    }
  }

  /**
   * Register default themes
   */
  private registerDefaultThemes(): void {
    DEFAULT_THEMES.forEach(theme => {
      this.themes.set(theme.id, theme);
    });
  }

  /**
   * Register a custom theme
   */
  registerTheme(theme: Theme): void {
    this.themes.set(theme.id, theme);
  }

  /**
   * Get all registered themes
   */
  getAllThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Get theme by ID
   */
  getTheme(id: string): Theme | undefined {
    return this.themes.get(id);
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): Theme | undefined {
    return this.themes.get(this.currentThemeId);
  }

  /**
   * Get current theme ID
   */
  getCurrentThemeId(): string {
    return this.currentThemeId;
  }

  /**
   * Set active theme
   */
  setTheme(themeId: string): void {
    const theme = this.themes.get(themeId);
    if (!theme) {
      console.warn(`Theme "${themeId}" not found. Using default theme.`);
      return;
    }

    // Apply CSS variables to document root
    Object.entries(theme.variables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    // Update current theme
    this.currentThemeId = themeId;

    // Persist choice
    if (this.config.persistChoice) {
      this.saveThemeToStorage(themeId);
    }

    // Notify listeners
    this.notifyListeners(themeId);

    // Emit custom event for components
    this.emitThemeChangeEvent(themeId);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    const isDark = this.currentThemeId === 'dark';
    this.setTheme(isDark ? 'light' : 'dark');
  }

  /**
   * Sync with system color scheme preference
   */
  private syncWithSystemPreference(): void {
    // Check for high contrast first (higher priority)
    const prefersContrast = window.matchMedia('(prefers-contrast: more)');
    if (prefersContrast.matches) {
      this.setTheme('high-contrast');
      return;
    }

    // Check for dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.setTheme(prefersDark.matches ? 'dark' : 'light');
  }

  /**
   * Watch for system preference changes
   */
  private watchSystemPreferences(): void {
    // Watch color scheme
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      // Only sync if user hasn't manually selected a theme
      if (!localStorage.getItem(this.storageKey)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    };

    // Modern browsers
    if (darkModeQuery.addEventListener) {
      darkModeQuery.addEventListener('change', handleColorSchemeChange);
    } else {
      // Legacy browsers
      darkModeQuery.addListener(handleColorSchemeChange);
    }

    // Watch contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    const handleContrastChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(this.storageKey)) {
        this.setTheme(e.matches ? 'high-contrast' : 'dark');
      }
    };

    if (contrastQuery.addEventListener) {
      contrastQuery.addEventListener('change', handleContrastChange);
    } else {
      contrastQuery.addListener(handleContrastChange);
    }
  }

  /**
   * Load theme from localStorage
   */
  private loadThemeFromStorage(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to load theme from storage:', error);
      return null;
    }
  }

  /**
   * Save theme to localStorage
   */
  private saveThemeToStorage(themeId: string): void {
    try {
      localStorage.setItem(this.storageKey, themeId);
    } catch (error) {
      console.warn('Failed to save theme to storage:', error);
    }
  }

  /**
   * Add theme change listener
   */
  addListener(listener: ThemeChangeListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove theme change listener
   */
  removeListener(listener: ThemeChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(themeId: string): void {
    this.listeners.forEach(listener => {
      try {
        listener(themeId);
      } catch (error) {
        console.error('Theme listener error:', error);
      }
    });
  }

  /**
   * Emit DOM event for theme change
   */
  private emitThemeChangeEvent(themeId: string): void {
    const event = new CustomEvent('theme-changed', {
      detail: { themeId, theme: this.themes.get(themeId) }
    });
    document.dispatchEvent(event);
  }

  /**
   * Reset to default theme
   */
  reset(): void {
    localStorage.removeItem(this.storageKey);
    this.setTheme(this.config.defaultTheme);
  }

  /**
   * Cleanup (remove event listeners)
   */
  destroy(): void {
    this.listeners.clear();
    // Note: Media query listeners are not easily removable in all browsers
    // Consider storing references if destroy is critical
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();
