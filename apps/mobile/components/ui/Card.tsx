import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '../../theme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Accessible description when the whole card is the tap target. */
  accessibilityLabel?: string;
}

export function Card({ children, onPress, accessibilityLabel }: CardProps) {
  if (!onPress) {
    return <View style={styles.card}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function CardMeta({ children }: { children: ReactNode }) {
  return <Text style={styles.meta}>{children}</Text>;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.8 },
  title: { ...type.body, fontWeight: '600', color: colors.ink },
  meta: { ...type.caption, color: colors.taupe, marginTop: 2 },
  section: {
    ...type.label,
    color: colors.taupe,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
