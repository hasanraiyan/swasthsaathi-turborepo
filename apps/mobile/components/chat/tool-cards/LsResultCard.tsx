import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { parseLsResult } from '../../../lib/file-tool-results';
import { colors, spacing, statusColors, type } from '../../../theme';

interface LsResultCardProps {
  path: string;
  raw: string;
}

/** What `ls` found, as a small directory listing rather than raw lines of text. */
export function LsResultCard({ path, raw }: LsResultCardProps) {
  const { entries, error } = parseLsResult(raw);

  return (
    <View>
      <View style={styles.header}>
        <Feather name="folder" size={12} color={colors.taupe} />
        <Text style={styles.path} numberOfLines={1}>
          {path}
        </Text>
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>Empty.</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.path} style={styles.row}>
            <Feather
              name={entry.isDir ? 'folder' : 'file'}
              size={12}
              color={entry.isDir ? colors.marigoldText : colors.taupe}
            />
            <Text style={styles.name} numberOfLines={1}>
              {entry.path}
            </Text>
            <Text style={styles.tag}>{entry.isDir ? 'dir' : entry.size !== null ? `${entry.size} B` : ''}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  path: { ...type.caption, fontSize: 11, fontFamily: 'monospace', color: colors.taupe },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  name: { fontSize: 11, fontFamily: 'monospace', color: colors.ink, flex: 1 },
  tag: { fontSize: 10, color: colors.taupe },
  empty: { ...type.caption, fontSize: 11, color: colors.hairline, fontFamily: 'monospace' },
  error: { ...type.caption, fontSize: 11, color: statusColors.missed.ink, fontFamily: 'monospace' },
});
