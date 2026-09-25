import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Button, Card, Field, Notice, Screen, Subtitle, Title } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/api';
import { API_URL } from '../../lib/config';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await signIn(identifier, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Maintenance Decision Support</Title>
      <Subtitle>Sign in to access the maintenance decision support system.</Subtitle>
      <Notice>API endpoint: {API_URL}</Notice>
      <Card>
        <Field label="Email or username" value={identifier} onChangeText={setIdentifier} placeholder="you@example.com" keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy} />
      </Card>
      <Card>
        <Subtitle>No account yet? Register the first account on an empty database and it becomes the administrator.</Subtitle>
        <Link href="/(auth)/register" asChild>
          <Button title="Create an account" variant="secondary" onPress={() => undefined} />
        </Link>
      </Card>
    </Screen>
  );
}
