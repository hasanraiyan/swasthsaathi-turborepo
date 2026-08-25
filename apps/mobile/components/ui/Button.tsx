import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, type } from '../../theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  /** Destructive intent: stopping a medicine, deleting a record. */
  tone?: 'default' | 'danger';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  tone = 'default',
}: ButtonProps) {
  const inactive = disabled || loading;
  const accent = tone === 'danger' ? colors.brick : colors.pine;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: accent },
        variant === 'outline' && { borderWidth: 1.5, borderColor: accent },
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.cream : accent} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: variant === 'primary' ? colors.cream : accent },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ghost: { minHeight: 40 },
  pressed: { opacity: 0.75 },
  inactive: { opacity: 0.45 },
  label: { ...type.body, fontWeight: '600' },
});
