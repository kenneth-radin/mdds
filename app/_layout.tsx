import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';

// Auth guard: keeps the (auth) and (app) route groups in sync with the auth
// status. Without this, a successful signIn/register leaves the user stuck on
// the login screen because nothing navigates away from /(auth).
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

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
