import React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  KeyValue,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader
} from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import { API_URL } from '../../../lib/config';
import { fmtDateTime } from '../../../lib/format';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'End the current session on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void signOut(); } }
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Settings"
        subtitle="Session, backend connection and model access."
        badge={user ? <Badge text={user.role} tone="info" /> : undefined}
      />

      <Card>
        <SectionHeader
          title="Signed-in user"
          icon="person-outline"
          subtitle="Read from the session stored on this device"
        />
        <KeyValue label="Name" value={user?.name || '—'} />
        <KeyValue label="Username" value={user?.username || '—'} />
        <KeyValue label="Email" value={user?.email || '—'} />
        <KeyValue label="Role" value={user?.role || '—'} />
        <KeyValue label="Title" value={user?.title || '—'} />
      </Card>

      <Card>
        <SectionHeader
          title="Backend"
          icon="server-outline"
          subtitle="Where this app sends its requests"
        />
        <KeyValue label="API base URL" value={API_URL} />
        <KeyValue label="Current time" value={fmtDateTime(new Date().toISOString())} />
        <Notice tone="info" title="Reaching the backend from a phone">
          EXPO_PUBLIC_API_URL must point to your computer's LAN IP (same Wi-Fi) or a backend tunnel. Never put database
          or JWT secrets in this app.
        </Notice>
      </Card>

      <Card>
        <SectionHeader
          title="Machine learning"
          icon="hardware-chip-outline"
          subtitle="Layer 3 benchmark models"
        />
        <Muted>
          Model cards with dataset, licence, per-class metrics, confusion matrices and stated limitations, plus a form
          that scores entered operating parameters with the trained classifiers.
        </Muted>
        <Button
          title="Open AI predictions"
          variant="secondary"
          icon="sparkles-outline"
          onPress={() => router.push('/(app)/(tabs)/models')}
        />
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} />
    </Screen>
  );
}
