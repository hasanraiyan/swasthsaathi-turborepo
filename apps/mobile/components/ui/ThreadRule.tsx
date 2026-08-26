import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { colors } from '../../theme';

/**
 * The mark this app is meant to be recognised by.
 *
 * Two colours, tied together, the way a mauli or kalava thread -- the one
 * knotted at the wrist for wellbeing at a puja or a health ritual -- carries
 * more than one strand. Used sparingly and only where it means something: the
 * opening of a screen, and which section of the app someone is standing in.
 * Not a border pattern to be repeated everywhere, which would make it
 * decoration instead of a mark.
 */
export function ThreadRule({
  orientation = 'horizontal',
  style,
}: {
  orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
}) {
  return (
    <View style={[orientation === 'horizontal' ? styles.horizontal : styles.vertical, style]}>
      <View style={[styles.strand, styles.marigoldStrand]} />
      <View style={[styles.strand, styles.pineStrand]} />
    </View>
  );
}

const styles = StyleSheet.create({
  horizontal: { flexDirection: 'row', height: 3, width: 40, borderRadius: 2, overflow: 'hidden' },
  vertical: { flexDirection: 'column', width: 3, height: 22, borderRadius: 2, overflow: 'hidden' },
  strand: { flex: 1 },
  marigoldStrand: { backgroundColor: colors.marigold },
  pineStrand: { backgroundColor: colors.pine },
});
