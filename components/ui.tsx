import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  TextStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

export { theme };

export type Tone = 'info' | 'warning' | 'danger' | 'success';

export function Screen({
  children,
  scroll = true,
  contentStyle
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Math.max(insets.bottom + 24, 40);
  const paddingTop = Math.max(insets.top, 12);

  if (!scroll) {
    return <View style={[s.screen, { paddingTop, paddingBottom }, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop, paddingBottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  action,
  badge
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <View style={s.screenHeader}>
      <View style={s.screenHeaderRow}>
        <View style={{ flex: 1, marginRight: action || badge ? theme.space.md : 0 }}>
          <Text style={s.screenTitle}>{title}</Text>
        </View>
        {badge ? <View style={{ alignSelf: 'center' }}>{badge}</View> : null}
        {action ? <View style={{ alignSelf: 'center' }}>{action}</View> : null}
      </View>
      {subtitle ? <Text style={s.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  icon
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderRow}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={theme.primary}
            style={{ marginRight: theme.space.xs }}
          />
        ) : null}
        <Text style={s.sectionTitle}>{title}</Text>
        {action ? <View style={{ marginLeft: 'auto' }}>{action}</View> : null}
      </View>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  tone
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: 'default' | 'hero' | 'muted';
}) {
  const toneStyle =
    tone === 'hero' ? s.cardHero : tone === 'muted' ? s.cardMuted : s.card;
  return <View style={[toneStyle, style]}>{children}</View>;
}

export function PressableCard({
  children,
  onPress,
  style,
  selected = false
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.card,
        selected ? s.cardSelected : null,
        pressed ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null,
        style
      ]}
    >
      {children}
    </Pressable>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  onPress
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'primary' | 'warning';
  onPress?: () => void;
}) {
  const content = (
    <View
      style={[
        s.statCard,
        tone === 'primary' ? { borderColor: theme.primaryBorder, backgroundColor: theme.primarySoft } : null
      ]}
    >
      <View style={s.statCardTop}>
        <Text style={s.statLabel}>{label}</Text>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={tone === 'primary' ? theme.primary : theme.textMuted}
            style={{ marginLeft: theme.space.xs }}
          />
        ) : null}
      </View>
      <Text style={[s.statValue, tone === 'primary' ? { color: theme.primary } : null]}>{value}</Text>
      {hint ? <Text style={s.statHint}>{hint}</Text> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={s.statCardCell}>
        {content}
      </Pressable>
    );
  }
  return <View style={s.statCardCell}>{content}</View>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.title, style]}>{children}</Text>;
}

export function Subtitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.subtitle, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading = false,
  icon,
  style
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) {
  const getStyle = () => {
    switch (variant) {
      case 'secondary':
        return s.btnSecondary;
      case 'danger':
        return s.btnDanger;
      case 'ghost':
        return s.btnGhost;
      case 'outline':
        return s.btnOutline;
      default:
        return s.btnPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return s.btnTextSecondary;
      case 'danger':
        return s.btnTextDanger;
      case 'ghost':
        return s.btnTextGhost;
      case 'outline':
        return s.btnTextOutline;
      default:
        return s.btnTextPrimary;
    }
  };

  const iconColor =
    variant === 'primary' || variant === 'danger'
      ? '#ffffff'
      : variant === 'secondary'
      ? theme.textSecondary
      : variant === 'ghost'
      ? theme.textMuted
      : theme.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.buttonBase,
        getStyle(),
        (disabled || loading) && { opacity: 0.55 },
        pressed && !disabled && !loading && { opacity: 0.88, transform: [{ scale: 0.99 }] },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#fff' : theme.primary}
        />
      ) : (
        <View style={s.btnContent}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={iconColor}
              style={{ marginRight: theme.space.xs }}
            />
          ) : null}
          <Text style={[s.btnTextBase, getTextStyle()]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ButtonGroup({ children }: { children: React.ReactNode }) {
  return <View style={s.buttonGroup}>{children}</View>;
}

/**
 * Compact labelled icon button for the actions that belong to a single saved row
 * (edit, remove). A full-width Button reads as the main call to action of the
 * screen; these must stay visually secondary and sit side by side, so they use a
 * 40dp pill with the label spelled out for accessibility and for gloved hands.
 */
export function IconAction({
  icon,
  label,
  onPress,
  tone = 'default',
  disabled = false,
  style
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const palette = {
    default: { bg: theme.cardMuted, border: theme.border, fg: theme.textSecondary },
    primary: { bg: theme.primarySoft, border: theme.primaryBorder, fg: theme.primary },
    danger: { bg: theme.dangerSoft, border: theme.dangerBorder, fg: theme.danger }
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        s.iconAction,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !disabled && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.55 },
        style
      ]}
    >
      <Ionicons name={icon} size={16} color={palette.fg} />
      <Text style={[s.iconActionLabel, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Grouping row for IconAction buttons at the foot of a card. */
export function ActionRow({ children }: { children: React.ReactNode }) {
  return <View style={s.actionRow}>{children}</View>;
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={[s.input, props.style]}
      placeholderTextColor={theme.textSubtle}
    />
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  helper,
  error,
  multiline,
  numberOfLines = 3,
  required
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
  helper?: string;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  required?: boolean;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.label}>
          {label}
          {required ? <Text style={{ color: theme.danger }}> *</Text> : null}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSubtle}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={[
          s.input,
          multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: 10 },
          error ? { borderColor: theme.danger, backgroundColor: theme.dangerSoft } : null
        ]}
      />
      {error ? (
        <Text style={s.fieldError}>{error}</Text>
      ) : helper ? (
        <Text style={s.fieldHelper}>{helper}</Text>
      ) : null}
    </View>
  );
}

export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label?: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.choiceContainer}>
        {options.map((opt, index) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              // The container already draws the outer border, so the last option
              // must not add another one — otherwise the group ends in a double line.
              style={[
                s.choiceRow,
                index === options.length - 1 && { borderBottomWidth: 0 },
                selected && s.choiceRowSelected
              ]}
            >
              <View style={[s.radioOuter, selected && s.radioOuterSelected]}>
                {selected ? <View style={s.radioInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.choiceLabel, selected && s.choiceLabelSelected]}>
                  {opt.label}
                </Text>
                {opt.hint ? <Text style={s.choiceHint}>{opt.hint}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Badge({
  text,
  tone = 'info',
  size = 'md'
}: {
  text: string;
  tone?: Tone;
  size?: 'sm' | 'md';
}) {
  const getColors = () => {
    switch (tone) {
      case 'success':
        return { bg: theme.successSoft, text: theme.success, border: theme.successBorder };
      case 'warning':
        return { bg: theme.warningSoft, text: theme.warning, border: theme.warningBorder };
      case 'danger':
        return { bg: theme.dangerSoft, text: theme.danger, border: theme.dangerBorder };
      default:
        return { bg: theme.infoSoft, text: theme.info, border: theme.infoBorder };
    }
  };
  const colors = getColors();

  return (
    <View
      style={[
        s.badgeChip,
        { backgroundColor: colors.bg, borderColor: colors.border },
        size === 'sm' && { paddingVertical: 2, paddingHorizontal: 6 }
      ]}
    >
      <Text style={[s.badgeChipText, { color: colors.text }, size === 'sm' && { fontSize: 10 }]}>
        {text}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  icon,
  tone = 'default'
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const palette = {
    default: { bg: theme.cardMuted, border: theme.border, fg: theme.textSecondary },
    primary: { bg: theme.primarySoft, border: theme.primaryBorder, fg: theme.primary },
    success: { bg: theme.successSoft, border: theme.successBorder, fg: theme.success },
    warning: { bg: theme.warningSoft, border: theme.warningBorder, fg: theme.warning }
  }[tone];

  return (
    <View style={[s.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {icon ? <Ionicons name={icon} size={13} color={palette.fg} style={{ marginRight: 4 }} /> : null}
      <Text style={[s.chipText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Notice({
  children,
  tone = 'info',
  title,
  icon
}: {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const config = {
    info: {
      bg: theme.infoSoft,
      border: theme.infoBorder,
      text: '#1e3a8a',
      icon: (icon || 'information-circle-outline') as keyof typeof Ionicons.glyphMap,
      iconColor: theme.info
    },
    warning: {
      bg: theme.warningSoft,
      border: theme.warningBorder,
      text: '#78350f',
      icon: (icon || 'warning-outline') as keyof typeof Ionicons.glyphMap,
      iconColor: theme.warning
    },
    danger: {
      bg: theme.dangerSoft,
      border: theme.dangerBorder,
      text: '#7f1d1d',
      icon: (icon || 'alert-circle-outline') as keyof typeof Ionicons.glyphMap,
      iconColor: theme.danger
    },
    success: {
      bg: theme.successSoft,
      border: theme.successBorder,
      text: '#14532d',
      icon: (icon || 'checkmark-circle-outline') as keyof typeof Ionicons.glyphMap,
      iconColor: theme.success
    }
  }[tone];

  return (
    <View style={[s.noticeBanner, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Ionicons
        name={config.icon}
        size={20}
        color={config.iconColor}
        style={{ marginRight: theme.space.sm, marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[s.noticeTitle, { color: config.text }]}>{title}</Text> : null}
        <Text style={[s.noticeText, { color: config.text }]}>{children}</Text>
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon = 'file-tray-full-outline'
}: {
  title: string;
  message?: string;
  action?: { title: string; onPress: () => void };
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={s.emptyBox}>
      <View style={s.emptyIconCircle}>
        <Ionicons name={icon} size={28} color={theme.textMuted} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyMessage}>{message}</Text> : null}
      {action ? (
        <View style={{ marginTop: theme.space.md }}>
          <Button title={action.title} onPress={action.onPress} variant="primary" />
        </View>
      ) : null}
    </View>
  );
}

export function Loading({ label = 'Loading…', caption }: { label?: string; caption?: string }) {
  return (
    <View style={s.loadingBox}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={s.loadingLabel}>{label}</Text>
      {caption ? <Text style={s.loadingCaption}>{caption}</Text> : null}
    </View>
  );
}

export function KeyValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={s.kvRow}>
      <View style={{ flex: 1, marginRight: theme.space.sm }}>
        <Text style={s.kvLabel}>{label}</Text>
        {hint ? <Text style={s.kvHint}>{hint}</Text> : null}
      </View>
      <Text style={s.kvValue}>{value}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[s.dividerLine, style]} />;
}

export function Collapse({
  title,
  subtitle,
  children,
  defaultOpen = false,
  badge
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <View style={s.collapseWrapper}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [s.collapseHeader, pressed && { opacity: 0.8 }]}
      >
        <View style={{ flex: 1, marginRight: theme.space.sm }}>
          <Text style={s.collapseTitle}>{title}</Text>
          {subtitle ? <Text style={s.collapseSubtitle}>{subtitle}</Text> : null}
        </View>
        {badge ? <View style={{ marginRight: theme.space.xs }}>{badge}</View> : null}
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={theme.textMuted}
        />
      </Pressable>
      {open ? <View style={s.collapseBody}>{children}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  // Screens
  screen: {
    flex: 1,
    backgroundColor: theme.bg
  },
  content: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    gap: theme.space.md
  },

  // Headers
  screenHeader: {
    marginBottom: theme.space.xs
  },
  screenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  screenTitle: {
    ...theme.font.display,
    color: theme.text
  },
  screenSubtitle: {
    ...theme.font.subtitle,
    color: theme.textMuted,
    marginTop: theme.space.xs
  },
  sectionHeader: {
    marginTop: theme.space.sm,
    marginBottom: theme.space.xxs
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sectionTitle: {
    ...theme.font.section,
    color: theme.text
  },
  sectionSubtitle: {
    ...theme.font.caption,
    color: theme.textMuted,
    marginTop: 2
  },

  // Cards
  card: {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    ...theme.shadow.card
  },
  cardHero: {
    backgroundColor: theme.card,
    borderColor: theme.primaryBorder,
    borderWidth: 1.5,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    ...theme.shadow.hero
  },
  cardMuted: {
    backgroundColor: theme.cardMuted,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.space.md
  },
  cardSelected: {
    borderColor: theme.primary,
    borderWidth: 1.5,
    backgroundColor: theme.primarySoft
  },

  // Stat cards
  statCard: {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    minHeight: 88,
    justifyContent: 'space-between',
    ...theme.shadow.card
  },
  // Sizing cell for a card inside a statRow. flexBasis gives Yoga a real
  // hypothetical width (flex: 1 would use 0 and never wrap): a 3-card row wraps
  // to 2 + 1 when the screen is too narrow for three readable columns, and every
  // card grows to fill the line it lands on. Text inside is free to wrap.
  statCardCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 132
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space.xs
  },
  statLabel: {
    ...theme.font.overline,
    color: theme.textMuted,
    textTransform: 'uppercase',
    flex: 1
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.3
  },
  statHint: {
    ...theme.font.caption,
    color: theme.textMuted,
    marginTop: 2
  },

  // Typography
  title: {
    ...theme.font.title,
    color: theme.text,
    marginBottom: theme.space.xxs
  },
  subtitle: {
    ...theme.font.subtitle,
    color: theme.textMuted,
    marginBottom: theme.space.sm
  },
  label: {
    ...theme.font.captionMedium,
    color: theme.textSecondary,
    marginBottom: theme.space.xs
  },
  muted: {
    ...theme.font.caption,
    color: theme.textMuted,
    lineHeight: 18
  },
  // Buttons
  buttonBase: {
    minHeight: 48,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPrimary: {
    backgroundColor: theme.primary
  },
  btnSecondary: {
    backgroundColor: theme.secondarySoft,
    borderColor: theme.border,
    borderWidth: 1
  },
  btnDanger: {
    backgroundColor: theme.danger
  },
  btnGhost: {
    backgroundColor: 'transparent'
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderColor: theme.primary,
    borderWidth: 1
  },
  btnTextBase: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1
  },
  btnTextPrimary: {
    color: theme.primaryText
  },
  btnTextSecondary: {
    color: theme.text
  },
  btnTextDanger: {
    color: theme.textInverse
  },
  btnTextGhost: {
    color: theme.textSecondary
  },
  btnTextOutline: {
    color: theme.primary
  },
  buttonGroup: {
    gap: theme.space.sm
  },

  // Compact per-record actions
  iconAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1
  },
  iconActionLabel: {
    ...theme.font.captionMedium,
    // actionRow already wraps its buttons; this lets a long label inside one
    // button wrap instead of being cut with an ellipsis.
    flexShrink: 1
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.space.sm
  },

  // Fields
  field: {
    marginBottom: theme.space.md
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm + 2,
    backgroundColor: '#ffffff',
    color: theme.text,
    fontSize: 14,
    minHeight: 46
  },
  fieldHelper: {
    ...theme.font.caption,
    color: theme.textMuted,
    marginTop: theme.space.xs
  },
  fieldError: {
    ...theme.font.captionMedium,
    color: theme.danger,
    marginTop: theme.space.xs
  },

  // Radio choices
  choiceContainer: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: '#ffffff'
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
    minHeight: 48
  },
  choiceRowSelected: {
    backgroundColor: theme.primarySoft
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space.sm
  },
  radioOuterSelected: {
    borderColor: theme.primary
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.primary
  },
  choiceLabel: {
    ...theme.font.bodyMedium,
    color: theme.text
  },
  choiceLabelSelected: {
    color: theme.primary,
    fontWeight: '700'
  },
  choiceHint: {
    ...theme.font.caption,
    color: theme.textMuted,
    marginTop: 2
  },
  // Badges & chips
  badgeChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start'
  },
  badgeChipText: {
    ...theme.font.overline,
    textTransform: 'uppercase'
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 26,
    backgroundColor: theme.cardMuted,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 4
  },
  chipText: {
    fontSize: 12,
    color: theme.textSecondary,
    // Long chip labels wrap onto a second line instead of ending in "…".
    flexShrink: 1
  },

  // Banners
  noticeBanner: {
    flexDirection: 'row',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.space.md
  },
  noticeTitle: {
    ...theme.font.cardTitle,
    marginBottom: 2
  },
  noticeText: {
    ...theme.font.caption,
    lineHeight: 18
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.xl,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    backgroundColor: '#ffffff'
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.md
  },
  emptyTitle: {
    ...theme.font.cardTitle,
    color: theme.text,
    textAlign: 'center'
  },
  emptyMessage: {
    ...theme.font.caption,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: theme.space.xs,
    maxWidth: 280,
    lineHeight: 18
  },

  // Loading
  loadingBox: {
    padding: theme.space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm
  },
  loadingLabel: {
    ...theme.font.cardTitle,
    color: theme.text,
    marginTop: theme.space.xs
  },
  loadingCaption: {
    ...theme.font.caption,
    color: theme.textMuted,
    textAlign: 'center',
    maxWidth: 280
  },

  // Key-value rows
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6
  },
  kvLabel: {
    ...theme.font.caption,
    color: theme.textMuted
  },
  kvHint: {
    fontSize: 11,
    color: theme.textSubtle,
    marginTop: 1
  },
  kvValue: {
    ...theme.font.captionMedium,
    color: theme.text,
    flexShrink: 1,
    textAlign: 'right'
  },

  // Divider
  dividerLine: {
    height: 1,
    backgroundColor: theme.divider,
    marginVertical: theme.space.md
  },

  // Collapsible section
  collapseWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    marginTop: theme.space.sm,
    paddingTop: theme.space.sm
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.xs
  },
  collapseTitle: {
    ...theme.font.captionMedium,
    color: theme.textSecondary
  },
  collapseSubtitle: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 1
  },
  collapseBody: {
    marginTop: theme.space.sm
  }
});
