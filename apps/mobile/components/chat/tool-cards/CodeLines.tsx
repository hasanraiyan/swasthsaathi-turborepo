import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, statusColors } from '../../../theme';

export interface CodeRow {
  key: string;
  /** Line number, or a `+`/`-`/blank diff marker. */
  gutter: string;
  text: string;
  tone?: 'add' | 'remove';
}

const MAX_ROWS = 30;

/**
 * A block of monospace lines with a left gutter -- the shape both the file
 * reader and the diff view need.
 *
 * Horizontally scrollable rather than wrapped: a wrapped line of code breaks
 * the one thing a gutter is for, which is knowing which line you're reading.
 * Capped at 30 rows for the same reason `ToolTrace`'s own JSON view caps
 * itself -- this is evidence in a chat thread, not a file browser, and a
 * a 400-line note would otherwise make the trace the tallest thing on screen.
 */
export function CodeLines({ rows }: { rows: CodeRow[] }) {
  const shown = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - shown.length;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller}>
        <View>
          {shown.map((row) => (
            <View
              key={row.key}
              style={[styles.row, row.tone === 'add' && styles.add, row.tone === 'remove' && styles.remove]}
            >
              <Text
                style={[
                  styles.gutter,
                  row.tone === 'add' && styles.gutterAdd,
                  row.tone === 'remove' && styles.gutterRemove,
                ]}
              >
                {row.gutter}
              </Text>
              <Text style={styles.code}>{row.text.length > 0 ? row.text : ' '}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {hidden > 0 ? <Text style={styles.more}>+{hidden} more lines</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroller: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  row: { flexDirection: 'row', paddingHorizontal: spacing.xs },
  add: { backgroundColor: statusColors.taken.fill },
  remove: { backgroundColor: statusColors.missed.fill },
  gutter: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.hairline,
    width: 34,
    textAlign: 'right',
    marginRight: spacing.xs,
  },
  gutterAdd: { color: statusColors.taken.ink },
  gutterRemove: { color: statusColors.missed.ink },
  code: { fontSize: 11, fontFamily: 'monospace', color: colors.ink },
  more: { fontSize: 10, color: colors.taupe, marginTop: 2, fontStyle: 'italic' },
});
