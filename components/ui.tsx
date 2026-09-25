import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { theme } from './theme';

export { theme };

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={s.screen}>{children}</View>;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.subtitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={s.muted}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const bg = variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : '#475569';
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} style={[s.input, props.style]} placeholderTextColor="#94a3b8" />;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'danger' | 'success' }) {
  const colors: Record<string, string> = { info: '#e0e7ff', warning: '#fef3c7', danger: '#fee2e2', success: '#dcfce7' };
  return (
    <View style={[s.notice, { backgroundColor: colors[tone] }]}>
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

export function Badge({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warning' | 'danger' | 'success' }) {
  const colors: Record<string, string> = { info: theme.primary, warning: theme.warning, danger: theme.danger, success: theme.success };
  return <Text style={[s.badge, { color: colors[tone] }]}>{text.toUpperCase()}</Text>;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={s.divider} />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={theme.primary} />
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  card: { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: theme.muted, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  muted: { fontSize: 12, color: theme.muted, marginTop: 2 },
  field: { marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: theme.text, minHeight: 44 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  buttonText: { color: theme.primaryText, fontWeight: '700' },
  empty: { borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed', borderRadius: 12, padding: 18, backgroundColor: '#fff', marginBottom: 12 },
  emptyTitle: { fontWeight: '700', color: theme.text, marginBottom: 4 },
  emptyMessage: { color: theme.muted, fontSize: 12 },
  notice: { borderRadius: 10, padding: 12, marginBottom: 12 },
  noticeText: { color: '#334155', fontSize: 12, lineHeight: 18 },
  badge: { fontSize: 10, fontWeight: '800' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
  kvLabel: { color: theme.muted, fontSize: 12 },
  kvValue: { color: theme.text, fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 10 },
  loading: { padding: 24, alignItems: 'center', gap: 8 }
});
