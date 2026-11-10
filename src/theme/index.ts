/**
 * Design tokens for the MDSS sensor dashboard.
 *
 * Colors are re-exported UNCHANGED from components/theme.ts (the single source
 * of truth). The typography / spacing / radius / shadow scales below mirror the
 * grAIn-mobile-expo reference for STRUCTURE only — no color value was copied
 * from the reference. Every color used by the dashboard comes from `colors`,
 * which is the existing MDSS palette.
 */
import { theme } from '../../components/theme';

// Existing MDSS colors — exact values, do not edit here.
export const colors = theme;

// Typography scale (structure inspired by the reference's iOS-style ramp).
export const typography = {
  largeTitle: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  section: { fontSize: 14, fontWeight: '700' as const, lineHeight: 20, letterSpacing: 0.2 },
  cardTitle: { fontSize: 15, fontWeight: '700' as const, lineHeight: 21 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 21 },
  label: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.6 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  captionMedium: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  statValue: { fontSize: 28, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.4 },
  statUnit: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
} as const;

// Spacing scale — reuse the existing MDSS 4/8/12/16/20/24/32 ramp.
export const spacing = theme.space;

// Radius scale — reuse existing MDSS radii.
export const radius = theme.radius;

// Elevation — reuse existing MDSS shadows (card / hero).
export const shadow = theme.shadow;

// Layout tokens for responsive / web centering.
export const layout = {
  screenPadding: theme.space.lg,
  maxContentWidth: 960,
  statMinWidth: 140,
} as const;

export type DashboardTheme = {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  layout: typeof layout;
};
