import { useUser } from '@clerk/expo';
import Feather from '@expo/vector-icons/Feather';
import type { MedicationDoseWithMedicine, PreventiveCheck } from '@repo/contracts';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card, SectionHeader } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { ErrorNotice, Loading } from '../components/ui/States';
import { StatusPill } from '../components/ui/StatusPill';
import { clockTime, formatDose } from '../lib/format';
import { useDay, usePreventivePlan, useRecordDose } from '../lib/queries';
import { colors, radii, spacing, statusColors, type } from '../theme';

/** Enough to act on; the full list lives on the Staying well screen. */
const CHECKS_ON_TODAY = 2;

/**
 * Today: the whole person, not just the medicine box.
 *
 * Treatment and prevention sit on one screen, in that order of urgency -- a
 * dose due in ten minutes matters more right now than a screening due this
 * month. But someone with no medicines at all still has something here, which
 * is the difference between a companion and a pill reminder.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { user } = useUser();
  const day = useDay();
  const plan = usePreventivePlan();
  const record = useRecordDose();

  const greeting = `${timeGreeting()}${user?.firstName ? `, ${user.firstName}` : ''}`;
  const needsBaseline = plan.data ? !plan.data.snapshot.baselineComplete : false;
  const dueChecks =
    plan.data?.checks.filter((check) => check.status === 'overdue' || check.status === 'due') ?? [];
  const doses = day.data?.doses ?? [];

  function refresh() {
    void day.refetch();
    void plan.refetch();
  }

  return (
    <Screen
      title={greeting}
      subtitle={longDate()}
      menu
      onRefresh={refresh}
      refreshing={day.isRefetching || plan.isRefetching}
    >
      {record.isError ? <ErrorNotice error={record.error} /> : null}
      {day.isPending && plan.isPending ? <Loading label="Getting your day…" /> : null}
      {day.isError ? <ErrorNotice error={day.error} onRetry={() => void day.refetch()} /> : null}

      {needsBaseline ? (
        <Card onPress={() => router.push('/baseline')}>
          <View style={styles.promptRow}>
            <View style={styles.promptIcon}>
              <Feather name="user-check" size={18} color={colors.marigoldText} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.promptTitle}>Set up your health baseline</Text>
              <Text style={styles.promptBody}>
                Two minutes of questions, and Swasthya Saathi can tell you which checks you
                actually need.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.taupe} />
          </View>
        </Card>
      ) : null}

      {doses.length > 0 ? (
        <>
          <SectionHeader>Medicines today</SectionHeader>
          <Progress taken={day.data?.takenCount ?? 0} total={day.data?.totalCount ?? 0} />
          {doses.map((dose) => (
            <DoseRow
              key={dose.id}
              dose={dose}
              busy={record.isPending && record.variables?.doseId === dose.id}
              onRecord={(status) => record.mutate({ doseId: dose.id, status })}
            />
          ))}
        </>
      ) : null}

      {dueChecks.length > 0 ? (
        <>
          <SectionHeader>Staying well</SectionHeader>
          {dueChecks.slice(0, CHECKS_ON_TODAY).map((check) => (
            <CheckRow key={check.key} check={check} onPress={() => router.push('/checks')} />
          ))}
          {dueChecks.length > CHECKS_ON_TODAY ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/checks')}
              style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
            >
              <Text style={styles.moreLabel}>
                {dueChecks.length - CHECKS_ON_TODAY} more check
                {dueChecks.length - CHECKS_ON_TODAY === 1 ? '' : 's'} to look at
              </Text>
              <Feather name="arrow-right" size={14} color={colors.pine} />
            </Pressable>
          ) : null}
        </>
      ) : null}

      {/* A quiet nudge, not a takeover: someone with no medicines is not an
          empty app, they are a well person with prevention to get on with. */}
      {day.data && doses.length === 0 ? (
        <Card onPress={() => router.push('/medicines/new')}>
          <View style={styles.promptRow}>
            <View style={styles.promptIcon}>
              <Feather name="plus" size={18} color={colors.pine} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.promptTitle}>No medicines today</Text>
              <Text style={styles.promptBody}>
                Add one if you take anything regularly and it will show up here every day.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {plan.data && !needsBaseline && dueChecks.length === 0 && doses.length === 0 ? (
        <View style={styles.clear}>
          <Text style={styles.clearTitle}>Nothing needs you today</Text>
          <Text style={styles.clearBody}>
            Your checks are up to date and no medicines are due. That is the point.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function CheckRow({ check, onPress }: { check: PreventiveCheck; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${check.title}. ${check.appliesBecause}`}>
      <View style={styles.checkHeader}>
        <Text style={styles.checkTitle}>{check.title}</Text>
        <StatusPill
          status={check.status === 'overdue' ? 'missed' : 'pending'}
          label={check.status === 'overdue' ? 'Overdue' : 'Due'}
        />
      </View>
      <Text style={styles.checkWhy} numberOfLines={2}>
        {check.why}
      </Text>
    </Card>
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
  grow: { flex: 1 },
  pressed: { opacity: 0.7 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promptIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  promptTitle: { ...type.body, fontWeight: '600', color: colors.ink },
  promptBody: { ...type.caption, color: colors.taupe, marginTop: 2 },
  progress: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  progressCount: { ...type.title, color: colors.ink, marginBottom: spacing.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.hairline, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: statusColors.taken.ink },
  doseHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  doseText: { flex: 1 },
  time: { ...type.label, color: colors.marigoldText },
  medicine: { ...type.title, color: colors.ink, marginTop: 2 },
  dosage: { ...type.caption, color: colors.taupe, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  checkTitle: { ...type.body, fontWeight: '600', color: colors.ink, flex: 1 },
  checkWhy: { ...type.caption, color: colors.taupe, marginTop: 2 },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  moreLabel: { ...type.caption, color: colors.pine, fontWeight: '600' },
  clear: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  clearTitle: { ...type.title, color: colors.ink, textAlign: 'center' },
  clearBody: { ...type.body, color: colors.taupe, textAlign: 'center' },
});
