import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[styles.card, { opacity }]}>
          <View style={styles.textBlock}>
            <View style={[styles.bar, { width: '55%' }]} />
            <View style={[styles.bar, { width: '35%', marginTop: spacing.sm }]} />
          </View>
          <View style={styles.badge} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  textBlock: {
    flex: 1,
  },
  bar: {
    height: 14,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.xs,
  },
  badge: {
    width: 64,
    height: 24,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.pill,
    marginLeft: spacing.md,
  },
});
