/**
 * Home screen theme – purple/grey palette to match the design.
 * Includes semantic tokens for accessibility and consistency.
 */
export const homeColors = {
  // Background
  backgroundStart: '#F5F3FF',
  backgroundEnd: '#EDE9FE',
  backgroundMuted: '#F5F3FF',

  // Cards & surfaces
  cardBg: '#F9F9FB',
  cardBorder: '#EFEFF1',

  // Primary purple (buttons, active states, accents)
  primary: '#7C4DFF',
  primaryDark: '#5E35B1',
  primaryLight: '#9C66FF',
  logoBg: '#6D28D9',

  // Text (WCAG AA compliant)
  textDark: '#1F2937',
  textMuted: '#4B5563',  // Darkened from #6B7280 for WCAG AA 4.5:1 contrast
  textLight: '#6B7280',  // Use only for tertiary text

  // Semantic text on colored backgrounds
  onPrimary: '#FFFFFF',      // Text/icons on primary background
  onSurface: '#1F2937',      // Primary text on surfaces
  onSurfaceVariant: '#4B5563', // Secondary text on surfaces

  // Secondary accents (How It Works icons)
  accentTeal: '#0D9488',
  accentGreen: '#059669',
  accentOrange: '#EA580C',

  // Semantic colors
  error: '#F44336',
  errorContainer: '#F4433615',
  success: '#10B981',

  // Stars
  starYellow: '#FFC107',

  // Tab bar
  tabActive: '#7C4DFF',
  tabInactive: '#9CA3AF',
  tabBarBg: '#FFFFFF',
};
