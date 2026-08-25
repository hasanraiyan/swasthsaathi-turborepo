import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '../../lib/chat-store';
import { colors, radii, spacing, type } from '../../theme';

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'notice') {
    return (
      <View style={styles.notice}>
        <Feather name="info" size={14} color={colors.taupe} style={styles.noticeIcon} />
        <Text style={styles.noticeText}>{message.text}</Text>
      </View>
    );
  }

  const mine = message.role === 'user';
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={[styles.text, mine ? styles.textMine : styles.textTheirs]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

/**
 * Shown while a reply is being waited on.
 *
 * It stands for a pending request, not a mind being made up -- there is no
 * assistant behind it yet.
 */
export function TypingIndicator() {
  // Lazy `useState` rather than `useRef`: stable for the component's life, and
  // read during render to build the interpolation.
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.row, styles.rowTheirs]}>
      <View style={[styles.bubble, styles.theirs, styles.typing]}>
        {[0, 1, 2].map((dot) => (
          <Animated.View
            key={dot}
            style={[
              styles.dot,
              {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  // Staggered so the three read as a wave, not a blink.
                  outputRange: dot === 1 ? [0.6, 0.25] : [0.25, 0.6],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '86%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  mine: {
    backgroundColor: colors.pine,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  theirs: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  text: { ...type.body },
  textMine: { color: colors.cream },
  textTheirs: { color: colors.ink },
  typing: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.taupe },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.cream,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeIcon: { marginTop: 2 },
  noticeText: { ...type.caption, color: colors.taupe, flex: 1 },
});
