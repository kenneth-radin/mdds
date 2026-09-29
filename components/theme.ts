/**
 * Unified design tokens for the Maintenance Decision Support System.
 * Clean, modern, accessible contrast, calibrated for mobile use in an industrial plant.
 */
export const theme = {
  // Surfaces
  bg: '#f8fafc', // slate-50 — crisp, clean light neutral
  card: '#ffffff',
  cardMuted: '#f1f5f9', // slate-100
  border: '#e2e8f0', // slate-200
  borderFocus: '#4f46e5', // indigo-600
  divider: '#f1f5f9',

  // Typography
  text: '#0f172a', // slate-900 — high contrast
  textSecondary: '#334155', // slate-700 — body
  textMuted: '#64748b', // slate-500 — captions/meta
  muted: '#64748b', // alias for legacy screens
  textSubtle: '#94a3b8', // slate-400 — placeholders
  textInverse: '#ffffff',

  // Brand / Actions
  primary: '#4f46e5', // indigo-600 — primary call to action
  primaryHover: '#4338ca',
  primarySoft: '#eef2ff', // indigo-50
  primaryBorder: '#c7d2fe',
  primaryText: '#ffffff',

  secondary: '#0f172a',
  secondarySoft: '#f1f5f9',

  // Semantic statuses (paired with soft backgrounds for chips/banners)
  success: '#15803d', // green-700
  successSoft: '#ecfdf5',
  successBorder: '#bbf7d0',

  warning: '#b45309', // amber-700
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',

  danger: '#b91c1c', // red-700
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',

  info: '#1d4ed8', // blue-700
  infoSoft: '#eff6ff',
  infoBorder: '#bfdbfe',

  // Consistent 4/8/12/16/20/24/32 spacing scale (§7)
  space: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32
  },

  // Consistent radiuses (§31)
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999
  },

  // Typography scale (§17)
  font: {
    display: { fontSize: 22, fontWeight: '800' as const, lineHeight: 28, letterSpacing: -0.4 },
    title: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24, letterSpacing: -0.2 },
    subtitle: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
    section: { fontSize: 14, fontWeight: '700' as const, lineHeight: 20, letterSpacing: 0.2 },
    cardTitle: { fontSize: 15, fontWeight: '700' as const, lineHeight: 21 },
    body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 21 },
    bodyMedium: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    captionMedium: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
    overline: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.6 }
  },

  // Elevation / subtle shadow (§20)
  shadow: {
    card: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1
    },
    hero: {
      shadowColor: '#4f46e5',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2
    }
  }
} as const;

export type Theme = typeof theme;

