import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, inputBorderColor, radii, spacing, type, webOutlineReset } from '../../theme';

/**
 * Date of birth as three plainly-labelled numbers.
 *
 * Deliberately not a single `YYYY-MM-DD` box. Asking someone to remember a
 * format is the kind of thing that quietly excludes exactly the people this
 * product is meant to reach; three boxes marked Day, Month and Year need no
 * explaining.
 *
 * Emits `YYYY-MM-DD` once all three are sensible, and an empty string until
 * then, so a half-typed date is never mistaken for a real one.
 */
export function DateOfBirthField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const initial = splitDate(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  function update(next: { day?: string; month?: string; year?: string }) {
    const d = next.day ?? day;
    const m = next.month ?? month;
    const y = next.year ?? year;
    setDay(d);
    setMonth(m);
    setYear(y);
    onChange(compose(d, m, y));
  }

  const partial = [day, month, year].some(Boolean) && !compose(day, month, year);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Date of birth</Text>
      <View style={styles.row}>
        <Part label="Day" value={day} onChangeText={(v) => update({ day: v })} maxLength={2} />
        <Part label="Month" value={month} onChangeText={(v) => update({ month: v })} maxLength={2} />
        <Part
          label="Year"
          value={year}
          onChangeText={(v) => update({ year: v })}
          maxLength={4}
          wide
        />
      </View>
      <Text style={partial ? styles.invalid : styles.hint}>
        {partial ? 'Check the day, month and year.' : 'Your age decides which checks you need.'}
      </Text>
    </View>
  );
}

function Part({
  label,
  value,
  onChangeText,
  maxLength,
  wide = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  maxLength: number;
  wide?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.part, wide && styles.partWide]}>
      <TextInput
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={value}
        // Strip anything that isn't a digit rather than rejecting the whole
        // entry, so a stray character doesn't lose what was already typed.
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, maxLength))}
        keyboardType="number-pad"
        maxLength={maxLength}
        style={[styles.input, webOutlineReset, { borderColor: inputBorderColor(focused) }]}
        placeholder={label === 'Year' ? '1985' : label === 'Month' ? 'MM' : 'DD'}
        placeholderTextColor={colors.taupe}
      />
      <Text style={styles.partLabel}>{label}</Text>
    </View>
  );
}

function splitDate(value: string): { day: string; month: string; year: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return { day: '', month: '', year: '' };
  }
  return { year: match[1]!, month: match[2]!, day: match[3]! };
}

/** `YYYY-MM-DD`, or an empty string if the three parts aren't a real date. */
function compose(day: string, month: string, year: string): string {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const thisYear = new Date().getFullYear();

  if (!d || !m || !y || year.length !== 4) {
    return '';
  }
  if (m < 1 || m > 12 || y < 1900 || y > thisYear) {
    return '';
  }
  // Rejects 31 February rather than silently rolling it into March.
  const lastDay = new Date(y, m, 0).getDate();
  if (d < 1 || d > lastDay) {
    return '';
  }
  return `${y}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...type.label, color: colors.ink, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  part: { flex: 1 },
  partWide: { flex: 1.6 },
  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    textAlign: 'center',
  },
  partLabel: { ...type.caption, color: colors.taupe, textAlign: 'center', marginTop: 2 },
  hint: { ...type.caption, color: colors.taupe, marginTop: spacing.xs },
  invalid: { ...type.caption, color: colors.brick, marginTop: spacing.xs },
});
