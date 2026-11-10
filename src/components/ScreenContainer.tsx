import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { layout } from '../theme';

/**
 * Centers dashboard content with a max width on wide (desktop/web) screens so
 * cards don't stretch edge-to-edge, while staying full-width on phones.
 */
export function ScreenContainer({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWide = width > layout.maxContentWidth;
  return (
    <View style={[styles.outer, isWide && styles.outerWide]}>
      <View style={[styles.inner, isWide && { maxWidth: layout.maxContentWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
  },
  outerWide: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
});
