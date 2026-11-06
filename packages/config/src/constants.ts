/**
 * NIVA Shared Non-Secret Constants & Design Tokens Foundation
 * NOTE: Never place secrets, passwords, or private keys in this file.
 */

export const APP_CONFIG = {
  name: 'NIVA',
  tagline: 'The Persistent Personal AI Companion',
  version: '0.1.0',
  apiVersion: 'v1',
  defaultLocale: 'en-US',
  defaultTheme: 'light',
  ports: {
    web: 3000,
    api: 4000,
    ai: 8000,
    postgres: 5432,
    redis: 6379,
  },
  apiPrefix: '/api/v1',
} as const;

export const THEME_MODES = ['light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
