import type { AdherenceSummary } from '@repo/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, statusColors, type } from '../../../theme';

/** `medicationDoses.adherence`: an overall rate, its makeup, and the same per medicine. */
export function AdherenceCard({ summary }: { summary: AdherenceSummary }) {
  const pct = summary.adherenceRate !== null ? Math.round(summary.adherenceRate * 100) : null;

  return (
    <View>
      <View style={styles.headline}>
        <Text style={styles.rate}>{pct !== null ? `${pct}%` : '—'}</Text>
        <Text style={styles.rateLabel}>
          taken · {summary.from} to {summary.to}
        </Text>
      </View>

      <ProportionBar taken={summary.taken} missed={summary.missed} skipped={summary.skipped} pending={summary.pending} />

      {summary.perMedicine.map((medicine) => (
        <View key={medicine.medicineId} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {medicine.medicineName}
          </Text>
          <Text style={styles.medRate}>
            {medicine.adherenceRate !== null ? `${Math.round(medicine.adherenceRate * 100)}%` : '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ProportionBar({
  taken,
  missed,
  skipped,
  pending,
}: {
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
}) {
  const total = taken + missed + skipped + pending;
  if (total === 0) {
    return null;
  }
  return (
    <View style={styles.bar}>
      {taken > 0 ? <View style={[styles.segment, { flex: taken, backgroundColor: statusColors.taken.fill }]} /> : null}
      {missed > 0 ? <View style={[styles.segment, { flex: missed, backgroundColor: statusColors.missed.fill }]} /> : null}
      {skipped > 0 ? (
        <View style={[styles.segment, { flex: skipped, backgroundColor: statusColors.skipped.fill }]} />
      ) : null}
      {pending > 0 ? (
        <View style={[styles.segment, { flex: pending, backgroundColor: statusColors.pending.fill }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginBottom: spacing.xs },
  rate: { fontSize: 18, fontWeight: '700', color: colors.ink },
  rateLabel: { ...type.caption, fontSize: 11, color: colors.taupe },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.sm },
  segment: { height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  name: { fontSize: 12, color: colors.ink, flex: 1 },
  medRate: { fontSize: 11, color: colors.taupe },
});
