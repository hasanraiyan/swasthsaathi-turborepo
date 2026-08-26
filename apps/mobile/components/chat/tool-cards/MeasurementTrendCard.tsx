import type { MeasurementTrend } from '@repo/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { humanize } from '../../../lib/format';
import { colors, spacing, statusColors } from '../../../theme';
import { Stat } from './Stat';

/**
 * `measurements.trend` in the shape it actually is: aggregate stats over a
 * window, not a day-by-day series -- there is no history array to draw a
 * sparkline from, only latest/average/min/max. The range bar is the honest
 * version of that: where today's reading and the average sit between the
 * lowest and highest value seen, nothing invented beyond what the capability
 * returns.
 */
export function MeasurementTrendCard({ trend }: { trend: MeasurementTrend }) {
  if (trend.count === 0) {
    return <Text style={styles.empty}>No {humanize(trend.type).toLowerCase()} readings in this range.</Text>;
  }

  const unit = trend.unit;
  const fmt = (value: number | null, secondary: number | null) =>
    value === null ? '—' : secondary !== null ? `${round(value)}/${round(secondary)}` : `${round(value)}`;

  return (
    <View>
      <View style={styles.stats}>
        <Stat label="Latest" value={`${fmt(trend.latest?.value ?? null, trend.latest?.valueSecondary ?? null)} ${unit}`} />
        <Stat label="Average" value={`${fmt(trend.average, trend.averageSecondary)} ${unit}`} />
        <Stat label="Min" value={trend.min !== null ? `${round(trend.min)} ${unit}` : '—'} />
        <Stat label="Max" value={trend.max !== null ? `${round(trend.max)} ${unit}` : '—'} />
      </View>
      {trend.min !== null && trend.max !== null && trend.max > trend.min ? (
        <RangeBar min={trend.min} max={trend.max} average={trend.average} latest={trend.latest?.value ?? null} />
      ) : null}
    </View>
  );
}

function RangeBar({
  min,
  max,
  average,
  latest,
}: {
  min: number;
  max: number;
  average: number | null;
  latest: number | null;
}) {
  const pct = (value: number): `${number}%` =>
    `${Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}%`;
  return (
    <View style={styles.track}>
      {average !== null ? <View style={[styles.dot, styles.dotAverage, { left: pct(average) }]} /> : null}
      {latest !== null ? <View style={[styles.dot, styles.dotLatest, { left: pct(latest) }]} /> : null}
    </View>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { fontSize: 11, color: colors.hairline, fontFamily: 'monospace' },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  dotAverage: { backgroundColor: colors.taupe },
  dotLatest: { backgroundColor: statusColors.taken.ink },
});
