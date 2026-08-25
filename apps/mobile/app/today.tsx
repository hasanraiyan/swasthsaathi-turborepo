import { useUser } from '@clerk/expo';
import type { MedicationDoseWithMedicine } from '@repo/contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../components/ui/States';
import { StatusPill } from '../components/ui/StatusPill';
import { clockTime, formatDose } from '../lib/format';
import { useDay, useRecordDose } from '../lib/queries';
import { colors, radii, spacing, statusColors, type } from '../theme';

/**
 * Today: the one screen a user opens every day.
 *
 * It answers a single question -- what do I take, and have I taken it -- so
 * everything else on it is subordinate to the dose list.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { user } = useUser();
  const day = useDay();
  const record = useRecordDose();

  const greeting = `${timeGreeting()}${user?.firstName ? `, ${user.firstName}` : ''}`;

  return (
    <Screen
      title={greeting}
      subtitle={longDate()}
      menu
      onRefresh={() => void day.refetch()}
      refreshing={day.isRefetching}
    >
      {record.isError ? <ErrorNotice error={record.error} /> : null}

      {day.isPending ? <Loading label="Checking today's medicines…" /> : null}
      {day.isError ? <ErrorNotice error={day.error} onRetry={() => void day.refetch()} /> : null}

      {day.data ? (
        day.data.totalCount === 0 ? (
          <EmptyState
            title="Nothing scheduled today"
            body="Add a medicine and set when you take it, and it will show up here every day."
            actionLabel="Add a medicine"
            onAction={() => router.push('/medicines/new')}
          />
        ) : (
          <>
            <Progress taken={day.data.takenCount} total={day.data.totalCount} />
            {day.data.doses.map((dose) => (
              <DoseRow
                key={dose.id}
                dose={dose}
                busy={record.isPending && record.variables?.doseId === dose.id}
                onRecord={(status) => record.mutate({ doseId: dose.id, status })}
              />
            ))}
          </>
        )
      ) : null}
    </Screen>
  );
}

function Progress({ taken, total }: { taken: number; total: number }) {
  const share = total === 0 ? 0 : taken / total;
  return (
    <View style={styles.progress}>
      <Text style={styles.progressCount}>
        {taken} of {total} taken
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
    </View>
  );
}

function DoseRow({
  dose,
  busy,
  onRecord,
}: {
  dose: MedicationDoseWithMedicine;
  busy: boolean;
  onRecord: (status: 'taken' | 'skipped') => void;
}) {
  const settled = dose.status !== 'pending';

  return (
    <Card>
      <View style={styles.doseHeader}>
        <View style={styles.doseText}>
          <Text style={styles.time}>{clockTime(dose.scheduledFor)}</Text>
          <Text style={styles.medicine}>{dose.medicineName}</Text>
          <Text style={styles.dosage}>
            {formatDose(dose.doseAmount, dose.doseUnit)}
            {dose.medicineStrength ? ` · ${dose.medicineStrength}` : ''}
          </Text>
        </View>
        <StatusPill status={dose.status} />
      </View>

      {!settled ? (
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button label="Taken" onPress={() => onRecord('taken')} loading={busy} />
          </View>
          <View style={styles.action}>
            <Button label="Skip" onPress={() => onRecord('skipped')} variant="outline" />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

function longDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const styles = StyleSheet.create({
  progress: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  progressCount: { ...type.title, color: colors.ink, marginBottom: spacing.sm },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: statusColors.taken.ink },
  doseHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  doseText: { flex: 1 },
  time: { ...type.label, color: colors.marigoldText },
  medicine: { ...type.title, color: colors.ink, marginTop: 2 },
  dosage: { ...type.caption, color: colors.taupe, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
});
