export const colors = {
  // Primary backgrounds
  background: '#0A0E1A',
  surface: '#111827',
  surfaceLight: '#1A2236',
  surfaceElevated: '#1E2A3F',

  // Accent
  gold: '#D4A853',
  goldLight: '#E8C97A',
  goldDark: '#B88D3A',
  goldMuted: 'rgba(212, 168, 83, 0.15)',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0A0E1A',

  // Status
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Borders & dividers
  border: '#1E293B',
  borderLight: '#334155',
  divider: 'rgba(255,255,255,0.06)',

  // AI chat
  userBubble: '#1A2236',
  aiBubble: 'rgba(212, 168, 83, 0.12)',

  // Overlay
  overlay: 'rgba(0,0,0,0.6)',
  shimmer: 'rgba(212, 168, 83, 0.05)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const },
  captionMedium: { fontSize: 13, fontWeight: '500' as const },
  small: { fontSize: 11, fontWeight: '500' as const },
} as const;