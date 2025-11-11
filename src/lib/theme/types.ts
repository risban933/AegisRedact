/**
 * Theme System Types
 *
 * Defines interfaces for the theme management system that enables
 * runtime theme switching with persistence.
 */

export interface ThemeVariable {
  name: string;
  value: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  variables: Record<string, string>;
}

export interface ThemeConfig {
  defaultTheme: string;
  syncWithSystem: boolean;
  persistChoice: boolean;
}

export type ThemeChangeListener = (themeId: string) => void;
