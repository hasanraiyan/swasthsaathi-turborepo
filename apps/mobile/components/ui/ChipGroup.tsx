import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '../../theme';

interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Turns `after_food` into "After food" unless a nicer label is supplied. */
  renderLabel?: (option: T) => string;
}

/**
 * A row of choices, in place of a native picker.
 *
 * Every option stays visible, which suits short enumerations like a medicine's
 * form and avoids a modal for a two-word decision.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLabel = humanize,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {renderLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...type.label, color: colors.ink, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.pine, borderColor: colors.pine },
  pressed: { opacity: 0.75 },
  chipLabel: { ...type.caption, color: colors.ink },
  chipLabelSelected: { color: colors.cream, fontWeight: '600' },
});
