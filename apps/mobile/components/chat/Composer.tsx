import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, inputBorderColor, spacing, type, webOutlineReset } from '../../theme';

interface ComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function Composer({ value, onChangeText, onSend, disabled = false }: ComposerProps) {
  const canSend = value.trim().length > 0 && !disabled;
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, { borderColor: inputBorderColor(focused) }]}>
      <TextInput
        accessibilityLabel="Message Swasthya Saathi"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask about your health record"
        placeholderTextColor={colors.taupe}
        // The border lives on the wrapper, so the input shows no ring of its
        // own -- including the browser's.
        style={[styles.input, webOutlineReset]}
        multiline
        // Leaves room for a few lines before the field starts scrolling.
        maxLength={2000}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        onPress={onSend}
        disabled={!canSend}
        hitSlop={6}
        style={({ pressed }) => [
          styles.send,
          !canSend && styles.sendIdle,
          pressed && canSend && styles.pressed,
        ]}
      >
        <Feather name="arrow-up" size={18} color={canSend ? colors.cream : colors.taupe} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pine,
  },
  sendIdle: { backgroundColor: colors.hairline },
  pressed: { opacity: 0.75 },
});
