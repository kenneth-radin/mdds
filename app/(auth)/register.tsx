import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Button, Card, Field, Notice, Screen, Subtitle, Title } from '../../components/ui';
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
      <Title>Create account</Title>
      <Subtitle>On an empty database the first registered account becomes the administrator.</Subtitle>
      <Card>
        <Field label="Full name" value={form.name} onChangeText={set('name')} placeholder="Juan Dela Cruz" />
        <Field label="Email" value={form.email} onChangeText={set('email')} placeholder="you@example.com" keyboardType="email-address" />
        <Field label="Username" value={form.username} onChangeText={set('username')} placeholder="juandc" />
        <Field label="Password" value={form.password} onChangeText={set('password')} placeholder="At least 6 characters" secureTextEntry />
        <Field label="Position / title (optional)" value={form.title} onChangeText={set('title')} placeholder="Maintenance Technician" />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title={busy ? 'Creating…' : 'Create account'} onPress={submit} disabled={busy} />
      </Card>
      <Link href="/(auth)/login" asChild>
        <Button title="Back to sign in" variant="secondary" onPress={() => undefined} />
      </Link>
    </Screen>
  );
}
