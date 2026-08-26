import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../../theme';

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { marginRight: spacing.md, marginBottom: spacing.xs },
  value: { fontSize: 14, fontWeight: '600', color: colors.ink },
  label: { fontSize: 10, color: colors.taupe, marginTop: 1 },
});
