import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, inputBorderColor, spacing, type, webOutlineReset } from '../../theme';

interface ComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onVoiceToggle?: () => void;
  isVoiceActive?: boolean;
  voiceStatusText?: string;
}

export function Composer({
  value,
  onChangeText,
  onSend,
  disabled = false,
  onVoiceToggle,
  isVoiceActive = false,
  voiceStatusText,
}: ComposerProps) {
  const canSend = value.trim().length > 0 && !disabled;
  const [focused, setFocused] = useState(false);
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (isVoiceActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isVoiceActive, pulseAnim]);

  return (
    <View style={styles.container}>
      {isVoiceActive && (
        <View style={styles.voiceBanner}>
          <View style={styles.pulseDot} />
          <Text style={styles.voiceBannerText}>
            {voiceStatusText || 'Voice Mode Active — Speak to your assistant'}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.wrapper,
          { borderColor: isVoiceActive ? colors.brick : inputBorderColor(focused) },
        ]}
      >
        <TextInput
          accessibilityLabel="Message Swasthya Saathi"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            isVoiceActive ? 'Listening… (speak or type)' : 'Ask about your health record'
          }
          placeholderTextColor={colors.taupe}
          style={[styles.input, webOutlineReset]}
          multiline
          maxLength={2000}
        />

        <View style={styles.actions}>
          {onVoiceToggle && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isVoiceActive ? 'Stop voice mode' : 'Start voice mode'}
              onPress={onVoiceToggle}
              hitSlop={6}
              style={({ pressed }) => [
                styles.actionBtn,
                isVoiceActive ? styles.voiceActiveBtn : styles.voiceIdleBtn,
                pressed && styles.pressed,
              ]}
            >
              <Animated.View style={{ transform: [{ scale: isVoiceActive ? pulseAnim : 1 }] }}>
                <Feather
                  name={isVoiceActive ? 'square' : 'mic'}
                  size={18}
                  color={isVoiceActive ? colors.cream : colors.pine}
                />
              </Animated.View>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            onPress={onSend}
            disabled={!canSend}
            hitSlop={6}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.send,
              !canSend && styles.sendIdle,
              pressed && canSend && styles.pressed,
            ]}
          >
            <Feather name="arrow-up" size={18} color={canSend ? colors.cream : colors.taupe} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  voiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: '#FDEEEB',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brick,
  },
  voiceBannerText: {
    ...type.body,
    fontSize: 12,
    color: colors.brick,
    fontWeight: '600',
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + 2,
    paddingVertical: spacing.xs + 2,
  },
  input: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    maxHeight: 120,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIdleBtn: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  voiceActiveBtn: {
    backgroundColor: colors.brick,
  },
  send: {
    backgroundColor: colors.pine,
  },
  sendIdle: {
    backgroundColor: colors.hairline,
  },
  pressed: {
    opacity: 0.75,
  },
});
