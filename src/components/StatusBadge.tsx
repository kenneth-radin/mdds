import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE_MAP: Record<StatusTone, { dot: string; bg: string; border: string; text: string }> = {
  success: { dot: colors.success, bg: colors.successSoft, border: colors.successBorder, text: colors.success },
  warning: { dot: colors.warning, bg: colors.warningSoft, border: colors.warningBorder, text: colors.warning },
  danger: { dot: colors.danger, bg: colors.dangerSoft, border: colors.dangerBorder, text: colors.danger },
  info: { dot: colors.info, bg: colors.infoSoft, border: colors.infoBorder, text: colors.info },
  muted: { dot: colors.textMuted, bg: colors.cardMuted, border: colors.border, text: colors.textSecondary },
};

export function StatusBadge({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: StatusTone;
}) {
  const c = TONE_MAP[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    ...typography.captionMedium,
  },
});
