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
 * The live call screen: real-time live captions, status indicator,
 * and call controls.
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
        <View style={styles.statusBadge}>
          {status === 'active' && <View style={styles.liveDot} />}
          <Text style={styles.status}>{STATUS_LABEL[status] ?? status}</Text>
        </View>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>

      <ScrollView
        ref={scroller}
        style={styles.flex}
        contentContainerStyle={styles.transcript}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        {transcript.length === 0 && status === 'active' ? (
          <View style={styles.emptyContainer}>
            <Feather name="mic" size={32} color={colors.marigold} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>Listening…</Text>
            <Text style={styles.emptySubtext}>
              Live captions will appear here as you and the assistant speak.
            </Text>
          </View>
        ) : (
          transcript.map((line, index) => {
            const isUser = line.role === 'user';
            return (
              <View
                key={index}
                style={[
                  styles.captionCard,
                  isUser ? styles.userCard : styles.assistantCard,
                ]}
              >
                <Text style={styles.speakerLabel}>
                  {isUser ? 'You' : 'Swasthya Saathi'}
                </Text>
                <Text style={[styles.line, isUser ? styles.userLine : styles.assistantLine]}>
                  {line.text}
                  {!line.committed && <Text style={styles.cursor}> ···</Text>}
                </Text>
              </View>
            );
          })
        )}
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
  header: { alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.marigold,
  },
  status: { ...type.title, color: colors.cream },
  error: { ...type.body, color: colors.marigold, marginTop: spacing.xs, textAlign: 'center' },
  transcript: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    marginBottom: spacing.md,
    opacity: 0.9,
  },
  emptyText: {
    ...type.title,
    color: colors.cream,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...type.caption,
    color: colors.cream,
    opacity: 0.6,
    textAlign: 'center',
  },
  captionCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    maxWidth: '92%',
  },
  userCard: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomRightRadius: 4,
  },
  assistantCard: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderBottomLeftRadius: 4,
  },
  speakerLabel: {
    ...type.caption,
    color: colors.marigold,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  line: { ...type.body, color: colors.cream, lineHeight: 22 },
  userLine: { color: colors.cream },
  assistantLine: { color: colors.cream },
  cursor: { color: colors.marigold, fontWeight: '700' },
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
