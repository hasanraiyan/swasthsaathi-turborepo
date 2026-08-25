import { Pressable, StyleSheet, Text, View } from 'react-native';

import { humanize } from '../../lib/format';
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

interface MultiChipGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  values: T[];
  onChange: (values: T[]) => void;
  renderLabel?: (option: T) => string;
  /** Chip that clears the selection, e.g. "None that I know of". */
  noneLabel?: string;
  hint?: string;
}

/** A ChipGroup where more than one answer can be true at once. */
export function MultiChipGroup<T extends string>({
  label,
  options,
  values,
  onChange,
  renderLabel = humanize,
  noneLabel,
  hint,
}: MultiChipGroupProps<T>) {
  function toggle(option: T) {
    onChange(
      values.includes(option) ? values.filter((value) => value !== option) : [...values, option],
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {noneLabel ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: values.length === 0 }}
            onPress={() => onChange([])}
            style={({ pressed }) => [
              styles.chip,
              values.length === 0 && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipLabel, values.length === 0 && styles.chipLabelSelected]}>
              {noneLabel}
            </Text>
          </Pressable>
        ) : null}
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(option)}
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
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
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
  hint: { ...type.caption, color: colors.taupe, marginTop: spacing.xs },
});
