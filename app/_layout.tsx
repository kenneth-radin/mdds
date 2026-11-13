import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { ToastProvider } from './lib/ToastContext';
import { ToastBanner } from './components/ToastBanner';
import { useAlertPolling, useBackgroundAwarePoller } from './lib/alertPoller';

function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    if (status === 'signedIn' && inAuthGroup) {
      router.replace('/(app)/(tabs)');
    } else if (status === 'signedOut' && inAppGroup) {
      router.replace('/(auth)/login');
    }
  }, [status, segments, router]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

// Root-level wrapper that mounts the global alert poller hooks
// (hooks must be called at component top-level, not inside JSX)
function GlobalAlertPoller() {
  useAlertPolling();
  useBackgroundAwarePoller();
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RootNavigator />
        {/* Root-level toast banner (absolute-positioned overlay) */}
        <ToastBanner />
        {/* Mount global alert poller at app root */}
        <GlobalAlertPoller />
      </ToastProvider>
    </AuthProvider>
  );
}
