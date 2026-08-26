import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '../../theme';

interface FilePresentCardProps {
  filePath: string;
  title?: string;
  description?: string;
  onOpen: (filePath: string) => void;
}

/**
 * A file the assistant wrote and wants you to look at.
 *
 * This is the one place in the thread that gets card treatment, because it is
 * the one thing in a conversation the user takes away with them -- a page for
 * a doctor, a summary of readings. The assistant is told not to paste the
 * contents into its reply as well, so this card is the whole delivery.
 */
export function FilePresentCard({ filePath, title, description, onOpen }: FilePresentCardProps) {
  const name = title?.trim() || filePath.split('/').pop() || filePath;
  const subtitle = description?.trim() || filePath;

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Feather name="file-text" size={16} color={colors.pine} />
      </View>

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.subtitle, !description && styles.path]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        onPress={() => onOpen(filePath)}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <Text style={styles.openLabel}>Open</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    marginVertical: spacing.xs,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  text: { flex: 1, minWidth: 0 },
  name: { ...type.caption, fontWeight: '700', color: colors.ink },
  subtitle: { ...type.caption, color: colors.taupe, fontSize: 11, marginTop: 1 },
  path: { color: colors.hairline },
  open: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.pine,
  },
  pressed: { opacity: 0.7 },
  openLabel: { ...type.caption, fontWeight: '600', color: colors.pine },
});
