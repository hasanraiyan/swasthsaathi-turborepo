import { StyleSheet, Text, View } from 'react-native';

import { summarizerFor } from '../../../lib/domain-records';
import { colors, type } from '../../../theme';
import { RecordRow } from './RecordRow';

const MAX_ROWS = 8;

/** A `.list`/`.history` result's `items`, as rows rather than a JSON array. */
export function RecordListCard({ toolName, items }: { toolName: string; items: unknown[] }) {
  const summarize = summarizerFor(toolName);
  if (!summarize) {
    return null;
  }

  if (items.length === 0) {
    return <Text style={styles.empty}>Nothing found.</Text>;
  }

  const shown = items.slice(0, MAX_ROWS);
  const hidden = items.length - shown.length;

  return (
    <View>
      {shown.map((item, index) => (
        <RecordRow key={index} summary={summarize(item as Record<string, unknown>)} />
      ))}
      {hidden > 0 ? <Text style={styles.more}>+{hidden} more</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...type.caption, fontSize: 11, color: colors.hairline, fontFamily: 'monospace' },
  more: { fontSize: 10, color: colors.taupe, marginTop: 2, fontStyle: 'italic' },
});
