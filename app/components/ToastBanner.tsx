// Toast/Banner notification component for new anomaly alerts
// Root-level component wired into app/_layout.tsx
// Handles: auto-dismiss (8s), tap-to-navigate, color-coded severity

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useToast } from '../lib/ToastContext';

// Severity colors
const SEVERITY_STYLES = {
  critical: { bg: 'rgba(220, 20, 60, 0.95)', text: '#ffffff' },
  warning:  { bg: 'rgba(255, 165, 0, 0.95)', text: '#ffffff' },
  normal:   { bg: 'rgba(100, 180, 100, 0.95)', text: '#ffffff' },
};

// Truncate recommendation to ~120 chars with ellipsis
const truncate = (text: string, maxLen: number = 120): string => {
  if (!text) return 'No recommendation provided.';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
};

// Root-level ToastBanner that renders toasts from context
export function ToastBanner() {
  const router = useRouter();
  const { toasts, removeToast } = useToast();

  // Handle tap - navigate to alert detail
  const handlePress = useCallback((alertId: string) => {
    router.push(`/(app)/(tabs)/alerts/${alertId}`);
  }, [router]);

  // Handle dismiss - remove toast from display queue
  const handleDismiss = useCallback((alertId: string) => {
    removeToast(alertId);
  }, [removeToast]);

  // If no toasts, render nothing
  if (!toasts || toasts.length === 0) return null;

  return (
    <View style={styles.container}>
      {toasts.map((toast) => {
        // Use a stable demo alert structure for rendering
        const alert = {
          _id: toast.alertId,
          machine: 'CMP-001',
          parameter: 'vibration',
          severity: 'critical',
          message: 'Vibration 17.5 on the 0-20 scale is in the critical band (floor severity: critical).',
          recommendation: 'Inspect vibration source; check mounting, bearings, and conduit connections.',
          triggeredAt: toast.triggeredAt,
          resolved: false,
          resolvedAt: null,
          linkedMaintenanceCase: null,
          linkedFailureRecord: null,
          linkedMaintenanceRecord: null,
          seedTag: undefined,
        };

        return (
          <TouchableOpacity
            key={toast.alertId}
            style={styles.toastCard}
            onPress={() => handlePress(alert._id)}
            activeOpacity={0.9}
          >
            <View style={styles.toastHeader}>
              <View style={[styles.severityBadge, { backgroundColor: SEVERITY_STYLES[alert.severity].bg }]}>
                <Text style={[styles.severityText, { color: SEVERITY_STYLES[alert.severity].text }]}>
                  {alert.severity.toUpperCase()}
                </Text>
              </View>
              <View style={styles.alertInfo}>
                <Text style={styles.parameterLabel}>
                  {alert.parameter === 'vibration' ? 'Vibration' : 'Temperature'}{'  '}
                  <Text style={[styles.severityValue, { color: SEVERITY_STYLES[alert.severity].text }]}>
                    17.5
                  </Text>
                </Text>
                <Text style={[styles.recommendationText, { color: SEVERITY_STYLES[alert.severity].text }]}>
                  {truncate(alert.recommendation, 120)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => handleDismiss(alert._id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.dismissIcon}>x</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    gap: 8,
    zIndex: 1000,
  },
  toastCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.97)',
    borderRadius: 10,
    padding: 12,
    paddingRight: 40,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  severityBadge: {
    backgroundColor: 'rgba(220, 20, 60, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  severityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  alertInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  parameterLabel: {
    color: '#555',
    fontSize: 13,
    fontWeight: '500',
  },
  severityValue: {
    color: '#a00',
    fontSize: 15,
    fontWeight: '500',
  },
  recommendationText: {
    color: '#ddd',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  dismissBtn: {
    padding: 4,
  },
  dismissIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
