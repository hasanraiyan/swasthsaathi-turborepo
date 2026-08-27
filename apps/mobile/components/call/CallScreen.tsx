import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '../../theme';
import { useVoiceCall } from './useVoiceCall';

const STATUS_LABEL: Record<string, string> = {
  connecting: 'Calling…',
  ready: 'Connecting…',
  active: 'On the call',
  reconnecting: 'Reconnecting…',
  ended: 'Call ended',
  error: 'Call failed',
};

/** How long a finished caption line stays up before fading, like a phone's live captions. */
const CAPTION_HOLD_MS = 3_200;

/**
 * The live call screen.
 *
 * Reads as a phone call, not a chat thread: one breathing avatar in the
 * middle standing in for who's on the line, a single caption underneath that
 * fades in as a line is spoken and fades back out once it's done (there is
 * no scrollback -- past turns already live in the call log), and a duration
 * clock instead of a message count.
 */
export function CallScreen({ sessionId }: { sessionId?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, transcript, errorMessage, endCall } = useVoiceCall(sessionId);

  const finished = status === 'ended' || status === 'error';
  const active = status === 'active';
  const connecting = status === 'connecting' || status === 'ready' || status === 'reconnecting';

  const currentLine = transcript.at(-1) ?? null;
  const assistantSpeaking = active && currentLine?.role === 'assistant' && !currentLine.committed;
  const liveLabel = !active ? null : assistantSpeaking ? 'Speaking…' : 'Listening…';

  // --- caption fade: appears with the line, holds once it's committed, then vanishes ---
  // Lazy `useState` rather than `useRef`: stable for the screen's life, but
  // read during render (`captionOpacity` is used directly in JSX below).
  const [captionOpacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!currentLine) {
      return;
    }
    captionOpacity.stopAnimation();
    Animated.timing(captionOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    if (!currentLine.committed) {
      return;
    }
    const timer = setTimeout(() => {
      Animated.timing(captionOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, CAPTION_HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on every new/updated line
  }, [transcript]);

  // --- avatar pulse while the call is live ---
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1_400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1_400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  // --- call duration clock ---
  const [elapsed, setElapsed] = useState(0);
  const callStartedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      return;
    }
    callStartedAt.current ??= Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (callStartedAt.current ?? Date.now())) / 1_000));
    }, 1_000);
    return () => clearInterval(id);
  }, [active]);

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
          {active && <View style={styles.liveDot} />}
          <Text style={styles.status}>
            {active ? formatDuration(elapsed) : (STATUS_LABEL[status] ?? status)}
          </Text>
        </View>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>

      <View style={styles.stage}>
        <View style={styles.avatarWrap}>
          <Animated.View
            style={[
              styles.pulseRing,
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
          <View style={styles.avatar}>
            {connecting ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Feather name="mic" size={36} color={colors.cream} />
            )}
          </View>
        </View>

        <Text style={styles.name}>Swasthya Saathi</Text>
        {liveLabel ? <Text style={styles.liveLabel}>{liveLabel}</Text> : null}

        <View style={styles.captionSlot}>
          {currentLine ? (
            <Animated.View style={{ opacity: captionOpacity }}>
              <Text style={styles.speakerLabel}>
                {currentLine.role === 'user' ? 'You' : 'Swasthya Saathi'}
              </Text>
              <Text style={styles.caption} numberOfLines={4}>
                {currentLine.text}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </View>

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

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pineDark },
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
  status: { ...type.title, color: colors.cream, fontVariant: ['tabular-nums'] },
  error: { ...type.body, color: colors.marigold, marginTop: spacing.xs, textAlign: 'center' },

  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  pulseRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: radii.avatar,
    backgroundColor: colors.marigold,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: radii.avatar,
    backgroundColor: colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...type.title, color: colors.cream, marginBottom: spacing.xs },
  liveLabel: { ...type.caption, color: colors.marigold, marginBottom: spacing.xl },

  captionSlot: {
    minHeight: 100,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  speakerLabel: {
    ...type.caption,
    color: colors.marigold,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  caption: {
    ...type.title,
    color: colors.cream,
    textAlign: 'center',
    lineHeight: 26,
  },

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
