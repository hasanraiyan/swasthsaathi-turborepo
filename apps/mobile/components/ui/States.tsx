import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../../lib/api';
import { colors, radii, spacing, statusColors, type } from '../../theme';
import { Button } from './Button';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centred}>
      <ActivityIndicator color={colors.pine} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

/**
 * An empty screen is an invitation to act, so it always names the next step
 * rather than only reporting that there is nothing here.
 */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          <Button label={actionLabel} onPress={onAction} variant="outline" />
        </View>
      ) : null}
    </View>
  );
}

/** Says what went wrong and how to fix it, in the app's voice. */
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError
      ? error.userMessage
      : error instanceof Error
        ? error.message
        : 'Something went wrong.';

  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <View style={styles.emptyAction}>
          <Button label="Try again" onPress={onRetry} variant="outline" tone="danger" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: { ...type.title, color: colors.ink, textAlign: 'center' },
  emptyAction: { marginTop: spacing.md, alignSelf: 'stretch' },
  muted: { ...type.body, color: colors.taupe, textAlign: 'center' },
  error: {
    backgroundColor: statusColors.missed.fill,
    borderRadius: radii.input,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { ...type.body, color: statusColors.missed.ink },
});
