import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export type TrendPoint = { label: string; value: number };

/**
 * Dependency-free trend chart (works on native + web without react-native-svg).
 * Renders a column/bar trend with a baseline, min/max axis labels and the
 * existing MDSS primary color for the bars. Values are normalized to the max.
 */
export function TrendChart({
  title,
  unit,
  points,
  height = 140,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No readings yet</Text>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  // Show a subset of x labels so they never overlap.
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.range}>
          {min.toFixed(1)}–{max.toFixed(1)} {unit}
        </Text>
      </View>
      <View style={[styles.plot, { height }]}>
        {points.map((p, i) => {
          const h = 8 + ((p.value - min) / range) * (height - 24);
          return (
            <View key={i} style={styles.colWrap}>
              <View style={[styles.col, { height: h }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {points.map((p, i) => (
          <View key={i} style={styles.axisCell}>
            {i % labelEvery === 0 ? (
              <Text style={styles.axisLabel} numberOfLines={1}>
                {p.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    color: colors.text,
  },
  range: {
    ...typography.caption,
    color: colors.textMuted,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 2,
  },
  colWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  col: {
    width: '70%',
    backgroundColor: colors.primary,
    borderRadius: radius.xs,
  },
  axis: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  axisCell: {
    flex: 1,
    alignItems: 'center',
  },
  axisLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
