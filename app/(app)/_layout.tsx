import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { Loading, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export default function AppLayout() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <Loading label="Loading session…" />
      </Screen>
    );
  }
  if (status === 'signedOut') return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
