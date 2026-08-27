import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, type } from '../../theme';
import { useVoiceCall } from './useVoiceCall';

const STATUS_LABEL: Record<string, string> = {
  connecting: 'Calling…',
  ready: 'Connecting…',
  active: 'On the call',
  reconnecting: 'Reconnecting…',
  ended: 'Call ended',
  error: 'Call failed',
};

/**
 * The live call itself: a status line, the transcript as captions, and one
 * button to hang up. No composer, no history -- this screen only exists
 * while a call is open.
 */
export function CallScreen({ sessionId }: { sessionId?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, transcript, errorMessage, endCall } = useVoiceCall(sessionId);
  const scroller = useRef<ScrollView>(null);

  const finished = status === 'ended' || status === 'error';

  useEffect(() => {
    if (!finished) {
      return;
    }
    const timer = setTimeout(() => router.back(), 1_200);
    return () => clearTimeout(timer);
  }, [finished, router]);

  const hangUp = () => {
    if (finished) {
      router.back();
    } else {
      endCall();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.status}>{STATUS_LABEL[status] ?? status}</Text>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>

      <ScrollView
        ref={scroller}
        style={styles.flex}
        contentContainerStyle={styles.transcript}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        {transcript.map((line, index) => (
          <Text
            key={index}
            style={[styles.line, line.role === 'user' ? styles.userLine : styles.assistantLine]}
          >
            {line.text}
          </Text>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={finished ? 'Close' : 'End call'}
          onPress={hangUp}
          style={({ pressed }) => [styles.hangUp, pressed && styles.pressed]}
        >
          <Feather name={finished ? 'x' : 'phone-off'} size={26} color={colors.cream} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pineDark },
  flex: { flex: 1 },
  header: { alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  status: { ...type.title, color: colors.cream },
  error: { ...type.body, color: colors.marigold, marginTop: spacing.xs, textAlign: 'center' },
  transcript: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  line: { ...type.body },
  userLine: { color: colors.cream, opacity: 0.7, textAlign: 'right' },
  assistantLine: { color: colors.cream },
  footer: { alignItems: 'center', paddingTop: spacing.lg },
  hangUp: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
