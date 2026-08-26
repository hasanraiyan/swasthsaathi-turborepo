import type { DaySchedule } from '@repo/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { clockTime } from '../../../lib/format';
import { colors, spacing, type } from '../../../theme';
import { StatusPill } from '../../ui/StatusPill';

/**
 * `medicationDoses.day`, the same data the Today screen itself is built on.
 *
 * `dose.status` is already `'pending' | 'taken' | 'skipped' | 'missed'` --
 * exactly `StatusPill`'s own status type, no translation needed.
 */
export function DoseDayCard({ schedule }: { schedule: DaySchedule }) {
  if (schedule.totalCount === 0) {
    return <Text style={styles.empty}>No doses scheduled for {schedule.date}.</Text>;
  }

  return (
    <View>
      <Text style={styles.header}>
        {schedule.takenCount} of {schedule.totalCount} taken
      </Text>
      {schedule.doses.map((dose) => (
        <View key={dose.id} style={styles.row}>
          <StatusPill status={dose.status} />
          <Text style={styles.name} numberOfLines={1}>
            {dose.medicineName}
          </Text>
          <Text style={styles.time}>{clockTime(dose.scheduledFor)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { ...type.caption, fontSize: 11, color: colors.taupe, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  name: { fontSize: 12, color: colors.ink, flex: 1 },
  time: { fontSize: 10, color: colors.taupe },
  empty: { fontSize: 11, color: colors.hairline, fontFamily: 'monospace' },
});
