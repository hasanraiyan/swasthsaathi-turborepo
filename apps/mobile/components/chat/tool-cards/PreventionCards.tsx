import type { HealthSnapshot, PreventivePlan } from '@repo/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { toneFor } from '../../../lib/domain-records';
import { humanize } from '../../../lib/format';
import { colors, spacing, type } from '../../../theme';
import { StatusPill } from '../../ui/StatusPill';
import { Stat } from './Stat';

const MAX_CHECKS = 8;

/**
 * `prevention.plan`: the same read `checks.tsx` shows as a full screen,
 * compressed into a trace.
 *
 * Only what needs attention gets a row -- the up-to-date checks are the
 * quiet majority by design, and listing all twelve every time would bury the
 * one or two that actually matter.
 */
export function PreventionPlanCard({ plan }: { plan: PreventivePlan }) {
  const outstanding = plan.checks.filter((check) => check.status !== 'up_to_date');
  const shown = outstanding.slice(0, MAX_CHECKS);
  const hidden = outstanding.length - shown.length;

  return (
    <View>
      <Text style={styles.header}>
        {plan.overdueCount > 0
          ? `${plan.overdueCount} overdue`
          : plan.dueCount > 0
            ? `${plan.dueCount} due`
            : 'All up to date'}
      </Text>
      {shown.map((check) => (
        <View key={check.key} style={styles.row}>
          <StatusPill status={toneFor(check.status)} label={humanize(check.status)} />
          <Text style={styles.name} numberOfLines={1}>
            {check.title}
          </Text>
        </View>
      ))}
      {hidden > 0 ? <Text style={styles.more}>+{hidden} more</Text> : null}
    </View>
  );
}

/** `prevention.snapshot`: age, BMI band, and the risk factors driving the plan. */
export function HealthSnapshotCard({ snapshot }: { snapshot: HealthSnapshot }) {
  return (
    <View>
      <View style={styles.stats}>
        {snapshot.age !== null ? <Stat label="Age" value={String(snapshot.age)} /> : null}
        {snapshot.bmi !== null ? (
          <Stat
            label="BMI"
            value={`${Math.round(snapshot.bmi * 10) / 10}${snapshot.bmiBand ? ` · ${humanize(snapshot.bmiBand)}` : ''}`}
          />
        ) : null}
      </View>
      {snapshot.riskFlags.length > 0 ? (
        <View style={styles.flags}>
          {snapshot.riskFlags.map((flag) => (
            <View key={flag.key} style={styles.flag}>
              <Text style={styles.flagText}>{flag.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!snapshot.baselineComplete ? <Text style={styles.incomplete}>Baseline incomplete</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { ...type.caption, fontSize: 11, color: colors.taupe, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  name: { fontSize: 12, color: colors.ink, flex: 1 },
  more: { fontSize: 10, color: colors.taupe, marginTop: 2, fontStyle: 'italic' },
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.xs },
  flag: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  flagText: { fontSize: 10, color: colors.marigoldText },
  incomplete: { fontSize: 10, color: colors.taupe, fontStyle: 'italic', marginTop: spacing.xs },
});
