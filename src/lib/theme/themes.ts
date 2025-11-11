/**
 * Built-in Theme Definitions
 *
 * Defines the default themes available in the application:
 * - Dark (default)
 * - Light
 * - High Contrast (accessibility)
 */

import type { Theme } from './types';

export const DARK_THEME: Theme = {
  id: 'dark',
  name: 'Dark',
  description: 'Default dark theme optimized for low-light environments',
  variables: {
    '--bg-primary': '#0b1020',
    '--bg-secondary': '#131a2e',
    '--bg-tertiary': '#1a2340',
    '--bg-elevated': '#1f2a47',
    '--text-primary': '#e2e8f0',
    '--text-secondary': '#94a3b8',
    '--text-tertiary': '#64748b',
    '--text-muted': '#475569',
    '--accent-blue': '#3b82f6',
    '--accent-blue-hover': '#2563eb',
    '--accent-red': '#ef4444',
    '--accent-red-hover': '#dc2626',
    '--accent-green': '#10b981',
    '--accent-yellow': '#f59e0b',
    '--accent-purple': '#a855f7',
    '--border-subtle': 'rgba(255, 255, 255, 0.08)',
    '--border-default': 'rgba(255, 255, 255, 0.12)',
    '--border-emphasis': 'rgba(255, 255, 255, 0.18)',
    '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.5)',
    '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.5)',
    '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.6)',
    '--overlay-bg': 'rgba(11, 16, 32, 0.85)'
  }
};

export const LIGHT_THEME: Theme = {
  id: 'light',
  name: 'Light',
  description: 'Light theme optimized for bright environments',
  variables: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f8fafc',
    '--bg-tertiary': '#f1f5f9',
    '--bg-elevated': '#ffffff',
    '--text-primary': '#0f172a',
    '--text-secondary': '#334155',
    '--text-tertiary': '#64748b',
    '--text-muted': '#94a3b8',
    '--accent-blue': '#2563eb',
    '--accent-blue-hover': '#1d4ed8',
    '--accent-red': '#dc2626',
    '--accent-red-hover': '#b91c1c',
    '--accent-green': '#059669',
    '--accent-yellow': '#d97706',
    '--accent-purple': '#9333ea',
    '--border-subtle': 'rgba(0, 0, 0, 0.06)',
    '--border-default': 'rgba(0, 0, 0, 0.12)',
    '--border-emphasis': 'rgba(0, 0, 0, 0.18)',
    '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.1)',
    '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.15)',
    '--overlay-bg': 'rgba(15, 23, 42, 0.7)'
  }
};

export const HIGH_CONTRAST_THEME: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'High contrast theme for maximum accessibility (WCAG AAA)',
  variables: {
    '--bg-primary': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--bg-tertiary': '#141414',
    '--bg-elevated': '#1a1a1a',
    '--text-primary': '#ffffff',
    '--text-secondary': '#f0f0f0',
    '--text-tertiary': '#d0d0d0',
    '--text-muted': '#b0b0b0',
    '--accent-blue': '#00bfff',
    '--accent-blue-hover': '#00a8e6',
    '--accent-red': '#ff0000',
    '--accent-red-hover': '#cc0000',
    '--accent-green': '#00ff00',
    '--accent-yellow': '#ffff00',
    '--accent-purple': '#ff00ff',
    '--border-subtle': 'rgba(255, 255, 255, 0.3)',
    '--border-default': 'rgba(255, 255, 255, 0.5)',
    '--border-emphasis': 'rgba(255, 255, 255, 0.8)',
    '--shadow-sm': '0 1px 2px rgba(255, 255, 255, 0.3)',
    '--shadow-md': '0 4px 6px rgba(255, 255, 255, 0.3)',
    '--shadow-lg': '0 10px 15px rgba(255, 255, 255, 0.4)',
    '--overlay-bg': 'rgba(0, 0, 0, 0.95)'
  }
};

export const DEFAULT_THEMES: Theme[] = [
  DARK_THEME,
  LIGHT_THEME,
  HIGH_CONTRAST_THEME
];
