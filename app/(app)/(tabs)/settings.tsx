import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActionRow,
  Badge,
  Button,
  Card,
  ChoiceGroup,
  Divider,
  EmptyState,
  IconAction,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  theme
} from '../../../components/ui';
import { ApiError, api, errorMessage } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { API_URL } from '../../../lib/config';
import { fmtDateTime } from '../../../lib/format';
import { AuthUser } from '../../../lib/types';

type RoleChoice = AuthUser['role'];

const ROLE_OPTIONS: Array<{ value: RoleChoice; label: string; hint: string }> = [
  { value: 'admin', label: 'Admin', hint: 'Everything, plus manages accounts' },
  { value: 'technician', label: 'Technician', hint: 'Records work and opens cases' },
  { value: 'viewer', label: 'Viewer', hint: 'Reads reports, changes nothing' }
];

const ROLE_TONE: Record<RoleChoice, 'warning' | 'info' | 'success'> = {
  admin: 'warning',
  technician: 'info',
  viewer: 'success'
};

function roleLabel(role: RoleChoice): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

/**
 * Account administration. Registration always produces a technician (the first
 * account on an empty database excepted), so this card is the only way a second
 * admin or a viewer ever gets created. Both endpoints answer 403 to anyone who is
 * not an admin, which is why the whole card renders only for admins.
 */
function TeamSection() {
  const { user: me, refreshUser, signOut } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<RoleChoice>('technician');
  const [savingId, setSavingId] = useState<string | null>(null);
  // Deletion is confirmed inline rather than through a native Alert dialog,
  // which never renders on some devices and makes the button look dead.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<{ users: AuthUser[] }>('/api/auth/users');
      setUsers(result.users);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const startEdit = (account: AuthUser) => {
    setError('');
    setFeedback('');
    setDraftRole(account.role);
    setEditingId(account.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftRole('technician');
  };

  const saveRole = async (account: AuthUser) => {
    setSavingId(account.id);
    setError('');
    setFeedback('');
    try {
      await api.put(`/api/auth/users/${account.id}/role`, { role: draftRole });
      const isSelf = account.id === me?.id;
      cancelEdit();
      setFeedback(
        isSelf
          ? 'Your own role changed. Sign in again for it to take effect on this device.'
          : `${account.name || account.username} is now ${roleLabel(draftRole).toLowerCase()}.`
      );
      if (isSelf) await refreshUser();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const askDelete = (account: AuthUser) => {
    setError('');
    setFeedback('');
    setPendingDeleteId(account.id);
  };

  const confirmDelete = async (account: AuthUser) => {
    setDeletingId(account.id);
    setError('');
    try {
      await api.del(`/api/auth/users/${account.id}`);
      setPendingDeleteId(null);
      if (account.id === me?.id) {
        // The token stored on this device belongs to the account that no longer
        // exists, so end the session instead of leaving it to fail on its own.
        await signOut();
        return;
      }
      setFeedback(`${account.name || account.username}'s account was deleted. Their records remain.`);
      await load();
    } catch (err) {
      // A 404 here means the API answering at API_URL is an older build without
      // the deletion route, which is a deployment gap rather than a user mistake,
      // so say so plainly instead of surfacing Express's "Route not found" text.
      setError(
        err instanceof ApiError && err.status === 404
          ? `The backend at ${API_URL} does not have account deletion yet (DELETE /api/auth/users/:id). Deploy the latest backend build, then try again. No account was changed.`
          : errorMessage(err)
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <SectionHeader
        title="Team and roles"
        icon="people-outline"
        subtitle="See who can change data, and change it"
      />

      {error ? (
        <Notice tone="danger" title="Request failed">
          {error}
        </Notice>
      ) : null}
      {feedback ? (
        <Notice tone="success" title="Done">
          {feedback}
        </Notice>
      ) : null}

      {loading ? (
        <Loading label="Loading accounts…" caption="GET /api/auth/users" />
      ) : users.length === 0 ? (
        <EmptyState
          title="No accounts listed"
          message="The backend answered but returned no users."
          icon="people-outline"
          action={{ title: 'Try again', onPress: () => void load() }}
        />
      ) : (
        users.map((account, index) => {
          const editing = editingId === account.id;
          return (
            <View key={account.id}>
              {index > 0 ? <Divider /> : null}
              <View style={st.account}>
                <View style={st.accountHead}>
                  <View style={st.accountNames}>
                    <Text style={st.accountName}>{account.name || account.username}</Text>
                    <Text style={st.accountMeta}>
                      @{account.username}
                      {account.id === me?.id ? ' · you' : ''}
                      {account.title ? ` · ${account.title}` : ''}
                    </Text>
                  </View>
                  <Badge text={roleLabel(account.role)} tone={ROLE_TONE[account.role]} />
                </View>

                {editing ? (
                  <>
                    <ChoiceGroup
                      label="Access level"
                      value={draftRole}
                      options={ROLE_OPTIONS}
                      onChange={setDraftRole}
                    />
                    <ActionRow>
                      <IconAction icon="close-outline" label="Cancel" onPress={cancelEdit} />
                      <IconAction
                        icon="checkmark-outline"
                        label={savingId === account.id ? 'Saving…' : 'Save role'}
                        tone="primary"
                        disabled={savingId === account.id || draftRole === account.role}
                        onPress={() => void saveRole(account)}
                      />
                    </ActionRow>
                  </>
                ) : pendingDeleteId === account.id ? (
                  <>
                    <Notice tone="danger" title="Delete this account?">
                      {account.name || account.username} loses access immediately
                      {account.id === me?.id ? ', including the session on this device' : ''}. Records they created
                      stay in the database. This cannot be undone.
                    </Notice>
                    <ActionRow>
                      <IconAction icon="close-outline" label="Cancel" onPress={() => setPendingDeleteId(null)} />
                      <IconAction
                        icon="trash-outline"
                        label={deletingId === account.id ? 'Deleting…' : 'Confirm delete'}
                        tone="danger"
                        disabled={deletingId === account.id}
                        onPress={() => void confirmDelete(account)}
                      />
                    </ActionRow>
                  </>
                ) : (
                  <ActionRow>
                    <Text style={st.accountEmail}>{account.email}</Text>
                    <IconAction
                      icon="shield-checkmark-outline"
                      label="Change role"
                      tone="primary"
                      onPress={() => startEdit(account)}
                    />
                    <IconAction icon="trash-outline" label="Delete" tone="danger" onPress={() => askDelete(account)} />
                  </ActionRow>
                )}
              </View>
            </View>
          );
        })
      )}

      <Notice tone="info" title="When a change takes effect">
        The role travels inside the JWT, so somebody who changes role keeps the access of the session they are already
        signed in with until they sign out and back in. The backend refuses to demote or delete the last remaining
        admin. Deleting an account revokes access but keeps the records that account created.
      </Notice>
    </Card>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  // Sign-out is confirmed inline like every other destructive action here: the
  // native Alert dialog it used to open never renders on some devices, which
  // made the button look broken.
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

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

      {user?.role === 'admin' ? <TeamSection /> : null}

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
          A form that scores entered operating parameters with the trained AI4I 2020 benchmark classifiers; every
          prediction carries the measured metrics behind it.
        </Muted>
        <Button
          title="Open AI predictions"
          variant="secondary"
          icon="sparkles-outline"
          onPress={() => router.push('/(app)/(tabs)/models')}
        />
      </Card>

      {confirmingSignOut ? (
        <Notice tone="danger" title="End this session?">
          The sign-in token stored on this device is removed. You can sign in again at any time.
        </Notice>
      ) : null}
      {confirmingSignOut ? (
        <View style={st.signOutRow}>
          <Button
            title="Cancel"
            variant="outline"
            style={{ flex: 1, marginRight: theme.space.sm }}
            onPress={() => setConfirmingSignOut(false)}
          />
          <Button
            title="Confirm sign out"
            variant="danger"
            icon="log-out-outline"
            style={{ flex: 1 }}
            onPress={() => void signOut()}
          />
        </View>
      ) : (
        <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={() => setConfirmingSignOut(true)} />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  account: {
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xs
  },
  accountHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    marginBottom: theme.space.xs
  },
  accountNames: {
    flex: 1
  },
  accountName: {
    ...theme.font.cardTitle,
    color: theme.text
  },
  accountMeta: {
    ...theme.font.caption,
    color: theme.textMuted,
    marginTop: theme.space.xxs
  },
  accountEmail: {
    ...theme.font.caption,
    color: theme.textMuted,
    flex: 1,
    marginRight: theme.space.sm
  },
  signOutRow: {
    flexDirection: 'row'
  }
});
