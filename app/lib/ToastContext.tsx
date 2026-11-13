// ToastContext provider with AsyncStorage dedup persistence
// Used by: app/(app)/(tabs)/alerts/index.tsx and any screen that needs toast state
//
// Features:
//  - Global state (not screen-scoped)
//  - AsyncStorage dedup (survives app restarts)
//  - Client-side filter triggeredAt > appStartTime (newOnly approach)

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// App start timestamp — alerts with triggeredAt <= this are treated as "historical/seeded"
export const APP_START_TIME = Date.now();

export interface AlertItem {
  _id: string;
  machine: string;
  parameter: 'temperature' | 'vibration' | null;
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

export interface ToastItem {
  alertId: string;
  triggeredAt: number;
  shownAt: number;
}

interface ToastContextValue {
  loadShownIds: () => Promise<void>;
  markAlertShown: (alertId: string, triggeredAt: number) => Promise<void>;
  removeToast: (alertId: string) => void;
  isAlertNew: (alert: AlertItem) => boolean;
  getUnseenAlerts: (alerts: AlertItem[]) => AlertItem[];
  clearShownIds: () => Promise<void>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const SHOWN_ALERTS_KEY = 'mdss_shown_alert_ids';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [shownAlertIds, setShownAlertIds] = useState<Set<string>>(new Set());

  const loadShownIds = async () => {
    try {
      const stored = await AsyncStorage.getItem(SHOWN_ALERTS_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        setShownAlertIds(new Set(ids));
      }
    } catch (e) {
      console.warn('Failed to load shown alert IDs:', e);
    }
  };

  const saveShownIds = async () => {
    try {
      const ids = Array.from(shownAlertIds);
      await AsyncStorage.setItem(SHOWN_ALERTS_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Failed to save shown alert IDs:', e);
    }
  };

  const markAlertShown = async (alertId: string, triggeredAt: number) => {
    const now = Date.now();
    setToasts((prev) => [...prev, { alertId, triggeredAt, shownAt: now }]);
    setShownAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
    setTimeout(() => saveShownIds(), 500);
  };

  // Remove a toast from the display queue without unmarking it as shown
  const removeToast = (alertId: string) => {
    setToasts((prev) => prev.filter((t) => t.alertId !== alertId));
  };

  const isAlertNew = (alert: AlertItem): boolean => {
    const isNew = !shownAlertIds.has(alert._id);
    const isNewer = alert.triggeredAt > APP_START_TIME;
    return isNew && isNewer;
  };

  const getUnseenAlerts = (alerts: AlertItem[]): AlertItem[] => {
    return alerts.filter((a) => isAlertNew(a));
  };

  const clearShownIds = async () => {
    setShownAlertIds(new Set());
    await AsyncStorage.removeItem(SHOWN_ALERTS_KEY);
  };

  // Load shown IDs from AsyncStorage on provider mount
  useEffect(() => {
    loadShownIds();
  }, []);

  return (
    <ToastContext.Provider
      value={{
        loadShownIds,
        markAlertShown,
        removeToast,
        isAlertNew,
        getUnseenAlerts,
        clearShownIds,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
