import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, statusColors, type } from '../../theme';

type Status = keyof typeof statusColors;

/**
 * A dose or record state.
 *
 * The word is always present -- colour is a second signal, never the only one.
 */
export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const palette = statusColors[status];
  return (
    <View style={[styles.pill, { backgroundColor: palette.fill }]}>
      <Text style={[styles.label, { color: palette.ink }]}>{label ?? capitalise(status)}</Text>
    </View>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.button,
  },
  label: { ...type.caption, fontWeight: '600' },
});
