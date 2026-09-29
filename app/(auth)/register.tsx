import React, { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Field,
  Notice,
  Screen,
  ScreenHeader,
  theme
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/api';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', title: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await register(form);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Create account"
        subtitle="Your account keeps the maintenance records and the analyses together, per technician."
      />

      <Card>
        <Field
          label="Full name"
          value={form.name}
          onChangeText={set('name')}
          placeholder="Juan Dela Cruz"
          required
        />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          placeholder="you@example.com"
          keyboardType="email-address"
          required
        />
        <Field
          label="Username"
          value={form.username}
          onChangeText={set('username')}
          placeholder="juandc"
          helper="Used for audit trails on every record you add."
          required
        />
        <Field
          label="Password"
          value={form.password}
          onChangeText={set('password')}
          placeholder="At least 6 characters"
          secureTextEntry
          required
        />
        <Field
          label="Position / title (optional)"
          value={form.title}
          onChangeText={set('title')}
          placeholder="Maintenance Technician"
        />
        {error ? (
          <Notice tone="danger" title="Could not create the account">
            {error}
          </Notice>
        ) : null}
        <Button title="Create account" icon="person-add-outline" loading={busy} onPress={submit} />
      </Card>

      <Card tone="muted">
        <Chip label="Already registered?" icon="log-in-outline" />
        <View style={{ marginTop: theme.space.sm }}>
          <Link href="/(auth)/login" asChild>
            <Button title="Back to sign in" variant="outline" icon="arrow-back-outline" onPress={() => undefined} />
          </Link>
        </View>
      </Card>
    </Screen>
  );
}
