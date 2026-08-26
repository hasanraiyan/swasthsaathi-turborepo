import { StyleSheet, Text, View } from 'react-native';

import { lineRange, parseNumberedLines } from '../../../lib/file-tool-results';
import { colors } from '../../../theme';
import { CodeLines } from './CodeLines';

/** A file the assistant read, with its own line numbers rather than deepagents' raw prefix. */
export function ReadFileCard({ raw }: { raw: string }) {
  const lines = parseNumberedLines(raw);
  const range = lineRange(lines);

  return (
    <View>
      <CodeLines
        rows={lines.map((line, index) => ({
          key: `${index}-${line.label}`,
          gutter: line.label,
          text: line.text,
        }))}
      />
      {range ? (
        <Text style={styles.footer}>
          Lines {range.start}–{range.end} · {range.count} line{range.count === 1 ? '' : 's'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { fontSize: 10, color: colors.taupe, marginTop: 4 },
});
