import React from 'react';
import { Alert } from 'react-native';
import { Button, Card, KeyValue, Notice, Screen, Subtitle, Title } from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import { API_URL } from '../../../lib/config';
import { fmtDateTime } from '../../../lib/format';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'End the current session on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void signOut(); } }
    ]);
  };

  return (
    <Screen>
      <Title>Settings</Title>
      <Subtitle>Session and backend configuration.</Subtitle>
      <Card>
        <KeyValue label="Name" value={user?.name || '—'} />
        <KeyValue label="Username" value={user?.username || '—'} />
        <KeyValue label="Email" value={user?.email || '—'} />
        <KeyValue label="Role" value={user?.role || '—'} />
        <KeyValue label="Title" value={user?.title || '—'} />
      </Card>
      <Card>
        <KeyValue label="API base URL" value={API_URL} />
        <KeyValue label="Current time" value={fmtDateTime(new Date().toISOString())} />
        <Notice>
          To reach the backend from a physical phone, EXPO_PUBLIC_API_URL must point to your computer LAN IP (same Wi-Fi) or a backend tunnel. Do not put database or JWT secrets in this app.
        </Notice>
      </Card>
      <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
    </Screen>
  );
}
