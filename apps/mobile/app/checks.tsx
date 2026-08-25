import Feather from '@expo/vector-icons/Feather';
import type { CheckStatus, HealthSnapshot, PreventiveCheck } from '@repo/contracts';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card, SectionHeader } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { ErrorNotice, Loading } from '../components/ui/States';
import { StatusPill } from '../components/ui/StatusPill';
import { relativeDay } from '../lib/format';
import { useCompleteCheck, usePreventivePlan } from '../lib/queries';
import { colors, radii, spacing, statusColors, type } from '../theme';

/**
 * The preventive plan: what to get checked, when, and why.
 *
 * The "why" is not decoration. A screening schedule nobody understands gets
 * ignored, so every check carries the plain-language reason it exists and the
 * reason it applies to this particular person.
 */
export default function ChecksScreen() {
  const router = useRouter();
  const plan = usePreventivePlan();
  const complete = useCompleteCheck();

  return (
    <Screen
      title="Staying well"
      subtitle="Checks worth doing before anything is wrong"
      menu
      onRefresh={() => void plan.refetch()}
      refreshing={plan.isRefetching}
    >
      {plan.isPending ? <Loading label="Working out your plan…" /> : null}
      {plan.isError ? <ErrorNotice error={plan.error} onRetry={() => void plan.refetch()} /> : null}
      {complete.isError ? <ErrorNotice error={complete.error} /> : null}

      {plan.data ? (
        <>
          {!plan.data.snapshot.baselineComplete ? (
            <Card onPress={() => router.push('/baseline')}>
              <View style={styles.promptRow}>
                <Feather name="user-check" size={18} color={colors.marigoldText} />
                <View style={styles.grow}>
                  <Text style={styles.promptTitle}>Finish your health baseline</Text>
                  <Text style={styles.promptBody}>
                    This list is generic until we know your age, body and habits.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.taupe} />
              </View>
            </Card>
          ) : null}

          <Snapshot snapshot={plan.data.snapshot} />

          {GROUPS.map((group) => {
            const items = plan.data.checks.filter((check) => check.status === group.status);
            if (items.length === 0) {
              return null;
            }
            return (
              <View key={group.status}>
                <SectionHeader>{group.label}</SectionHeader>
                {items.map((check) => (
                  <CheckCard
                    key={check.key}
                    check={check}
                    busy={complete.isPending && complete.variables?.checkKey === check.key}
                    onDone={() => complete.mutate({ checkKey: check.key })}
                  />
                ))}
              </View>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

const GROUPS: { status: CheckStatus; label: string }[] = [
  { status: 'overdue', label: 'Overdue' },
  { status: 'due', label: 'Do these next' },
  { status: 'due_soon', label: 'Coming up' },
  { status: 'up_to_date', label: 'Up to date' },
];

/** Who you are, health-wise, and what it means for what you should watch. */
function Snapshot({ snapshot }: { snapshot: HealthSnapshot }) {
  return (
    <View>
      <View style={styles.stats}>
        {snapshot.age !== null ? <Stat label="Age" value={String(snapshot.age)} /> : null}
        {snapshot.bmi !== null ? (
          <Stat label="BMI" value={String(snapshot.bmi)} note={snapshot.bmiBand ?? undefined} />
        ) : null}
      </View>

      {snapshot.riskFlags.length > 0 ? (
        <>
          <SectionHeader>What to keep an eye on</SectionHeader>
          {snapshot.riskFlags.map((flag) => (
            <Card key={flag.key}>
              <Text style={styles.flagLabel}>{flag.label}</Text>
              <Text style={styles.flagDetail}>{flag.detail}</Text>
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>
        {label}
        {note ? ` · ${note}` : ''}
      </Text>
    </View>
  );
}

function CheckCard({
  check,
  busy,
  onDone,
}: {
  check: PreventiveCheck;
  busy: boolean;
  onDone: () => void;
}) {
  const settled = check.status === 'up_to_date';

  return (
    <Card>
      <View style={styles.checkHeader}>
        <Text style={styles.checkTitle}>{check.title}</Text>
        <StatusPill status={toneFor(check.status)} label={LABELS[check.status]} />
      </View>

      <Text style={styles.why}>{check.why}</Text>

      <View style={styles.metaRow}>
        <Feather name="user" size={12} color={colors.taupe} />
        <Text style={styles.meta}>{check.appliesBecause}</Text>
      </View>
      <View style={styles.metaRow}>
        <Feather name="repeat" size={12} color={colors.taupe} />
        <Text style={styles.meta}>
          {everyLabel(check.everyMonths)}
          {check.lastCompletedOn ? ` · last done ${relativeDay(check.lastCompletedOn)}` : ''}
        </Text>
      </View>

      {!settled ? (
        <View style={styles.action}>
          <Button label="I've had this done" size="small" variant="outline" onPress={onDone} loading={busy} />
        </View>
      ) : (
        <Text style={styles.nextDue}>Next one due {check.dueOn}</Text>
      )}
    </Card>
  );
}

const LABELS: Record<CheckStatus, string> = {
  overdue: 'Overdue',
  due: 'Due',
  due_soon: 'Soon',
  up_to_date: 'Done',
};

function toneFor(status: CheckStatus): 'taken' | 'pending' | 'missed' | 'skipped' {
  if (status === 'overdue') {
    return 'missed';
  }
  if (status === 'up_to_date') {
    return 'taken';
  }
  return status === 'due' ? 'pending' : 'skipped';
}

function everyLabel(months: number): string {
  if (months === 12) {
    return 'Once a year';
  }
  if (months < 12) {
    return `Every ${months} months`;
  }
  const years = months / 12;
  return `Every ${years} years`;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promptTitle: { ...type.body, fontWeight: '600', color: colors.ink },
  promptBody: { ...type.caption, color: colors.taupe, marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  statValue: { ...type.display, color: colors.pine },
  statLabel: { ...type.caption, color: colors.taupe, marginTop: 2, textTransform: 'capitalize' },
  flagLabel: { ...type.body, fontWeight: '600', color: colors.ink },
  flagDetail: { ...type.caption, color: colors.taupe, marginTop: 2 },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  checkTitle: { ...type.title, color: colors.ink, flex: 1 },
  why: { ...type.caption, color: colors.taupe, marginTop: spacing.xs, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginTop: spacing.xs },
  meta: { ...type.caption, color: colors.taupe, flex: 1 },
  action: { marginTop: spacing.md },
  nextDue: { ...type.caption, color: statusColors.taken.ink, marginTop: spacing.sm },
});
