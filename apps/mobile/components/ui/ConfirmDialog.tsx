import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, statusColors, type } from '../../theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red rather than pine -- for an action that can't be undone. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/**
 * A confirm prompt that actually works on web.
 *
 * `Alert.alert` is `react-native-web`'s whole implementation: `static alert()
 * {}`, a no-op. Every screen in this app that calls it for a destructive
 * action is silently doing nothing on the browser build -- the button just
 * fires and nothing happens, with no error to explain why. This is the
 * replacement: a real modal, styled to match the rest of the app, that works
 * identically on both.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss"
          onPress={busy ? undefined : onCancel}
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                destructive && styles.confirmButtonDanger,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>{busy ? 'Working…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 38, 32, 0.45)',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cream,
    borderRadius: radii.input,
    padding: spacing.lg,
  },
  title: { ...type.title, color: colors.ink },
  body: { ...type.body, color: colors.taupe, marginTop: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.button,
  },
  pressed: { opacity: 0.75 },
  cancelText: { ...type.body, fontWeight: '600', color: colors.taupe },
  confirmButton: { backgroundColor: colors.pine },
  confirmButtonDanger: { backgroundColor: statusColors.missed.ink },
  confirmText: { ...type.body, fontWeight: '600', color: colors.cream },
});
