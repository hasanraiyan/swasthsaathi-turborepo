import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function Wordmark({ tagline }: { tagline?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>
        <Text style={styles.swasth}>Swasth</Text>
        <Text style={styles.saathi}>Saathi</Text>
      </Text>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 8,
  },
  wordmark: {
    fontSize: 34,
    letterSpacing: -0.5,
  },
  swasth: {
    fontFamily: fonts.display,
    color: colors.pine,
  },
  saathi: {
    fontFamily: fonts.display,
    color: colors.marigoldText,
  },
  tagline: {
    fontFamily: fonts.displayItalic,
    fontSize: 15,
    color: colors.taupe,
    marginTop: 2,
  },
});
