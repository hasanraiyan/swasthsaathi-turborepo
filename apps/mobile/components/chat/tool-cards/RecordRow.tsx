import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import type { RecordSummary } from '../../../lib/domain-records';
import { colors, spacing, type } from '../../../theme';
import { StatusPill } from '../../ui/StatusPill';

/** One record from this app's own domain, shown the way the rest of the app shows one. */
export function RecordRow({ summary }: { summary: RecordSummary }) {
  return (
    <View style={styles.row}>
      <Feather name={summary.icon} size={12} color={colors.taupe} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {summary.title}
        </Text>
        {summary.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {summary.subtitle}
          </Text>
        ) : null}
      </View>
      {summary.status ? <StatusPill status={summary.status.tone} label={summary.status.label} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  text: { flex: 1, minWidth: 0 },
  title: { ...type.caption, fontSize: 12, color: colors.ink },
  subtitle: { fontSize: 10, color: colors.taupe, marginTop: 1 },
});
