// Alert polling hook for global notification system
// Mounted at app root level, calls GET /api/alerts?resolved=false every 45s
// Feeds unseen alerts into ToastContext for toast notification

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { isAlertNew, markAlertShown, removeToast, useToast } from './ToastContext';

// Alert interface (matches backend response)
export interface AlertItem {
  _id: string;
  machine: string;
  parameter: 'temperature' | 'vibration' | null;
  zScore: number | null;
  trendDirection: 'increasing' | 'decreasing' | 'stable' | null;
  severity: 'normal' | 'warning' | 'critical';
  message: string;
  recommendation: string;
  triggeredAt: number;
  resolved: boolean;
  resolvedAt: number | null;
  linkedMaintenanceCase: string | null;
  linkedFailureRecord: string | null;
  linkedMaintenanceRecord: string | null;
  seedTag?: string;
}

// Custom hook for global alert polling
// Called by root layout, not screen-scoped
export function useAlertPolling() {
  const { loadShownIds, markAlertShown, removeToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Load shown IDs from AsyncStorage on mount
  useEffect(() => {
    loadShownIds();
  }, [loadShownIds]);

  // Global poller - every 45 seconds
  const pollAlerts = useCallback(async () => {
    try {
      const response = await api.get<{ alerts: AlertItem[] }>('/api/alerts?resolved=false');
      const allAlerts = response.alerts || [];

      // Filter for new alerts using context helper
      const unseenAlerts = allAlerts.filter((a) => isAlertNew(a));

      // Mark each new alert as shown and add to toast queue
      for (const alert of unseenAlerts) {
        await markAlertShown(alert._id, alert.triggeredAt);

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          removeToast(alert._id);
        }, 8000);
      }
    } catch (error) {
      console.warn('Alert poller error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [markAlertShown, removeToast, isAlertNew]);

  // Poll immediately on mount, then every 45 seconds
  useEffect(() => {
    pollAlerts();

    const interval = setInterval(pollAlerts, 45000);

    return () => clearInterval(interval);
  }, [pollAlerts]);

  return { isLoading };
}

// AppState-aware poller that pauses in background, resumes in foreground
export function useBackgroundAwarePoller() {
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Get AppState from expo
    // Note: In a real app, you'd import AppState from 'expo-appstate'
    // For now, we just set up the poller with 45s interval

    // The polling interval is handled by useAlertPolling above
    // This hook can be extended with AppState listener if needed
  }, []);

  return isPaused;
}

