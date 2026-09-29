import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
      <View style={st.brand}>
        <View style={st.brandIcon}>
          <Ionicons name="construct-outline" size={26} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.tagRow}>
            <Chip label="Capstone project" icon="school-outline" />
          </View>
          <Text style={st.brandTag}>Machines · cases · evidence-backed suggestions</Text>
        </View>
      </View>

      <ScreenHeader
        title="Maintenance Decision Support"
        subtitle="Sign in to record problems, review past work and see what the analysis suggests next."
      />

      <Card>
        <Field
          label="Email or username"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="you@example.com"
          keyboardType="email-address"
          required
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          required
        />
        {error ? (
          <Notice tone="danger" title="Sign-in failed">
            {error}
          </Notice>
        ) : null}
        <Button title="Sign in" icon="log-in-outline" loading={busy} onPress={submit} />
      </Card>

      <Card tone="muted">
        <Chip label="New here?" icon="person-add-outline" />
        <View style={{ marginTop: theme.space.sm }}>
          <Link href="/(auth)/register" asChild>
            <Button title="Create an account" variant="outline" icon="person-add-outline" onPress={() => undefined} />
          </Link>
        </View>
      </Card>

      <View style={st.footer}>
        <Chip label={`API: ${API_URL.replace(/^https?:\/\//, '')}`} icon="server-outline" />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    marginBottom: theme.space.lg
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tagRow: {
    flexDirection: 'row',
    marginBottom: theme.space.xs
  },
  brandTag: {
    ...theme.font.caption,
    color: theme.textMuted
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.space.lg
  }
});

