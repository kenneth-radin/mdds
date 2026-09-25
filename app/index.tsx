import React from 'react';
import { Redirect } from 'expo-router';
import { Loading, Screen } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <Loading label="Checking session…" />
      </Screen>
    );
  }
  return <Redirect href={status === 'signedIn' ? '/(app)/(tabs)' : '/(auth)/login'} />;
}
