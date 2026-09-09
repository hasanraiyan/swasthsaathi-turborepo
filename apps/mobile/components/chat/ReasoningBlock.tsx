import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { colors, radii, spacing, type } from '../../theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ReasoningData {
  id: string;
  content: string;
  isStreaming?: boolean;
}

export function ReasoningBlock({ reasoning }: { reasoning: ReasoningData }) {
  const isStreaming = Boolean(reasoning.isStreaming);
  const [open, setOpen] = useState<boolean>(isStreaming);
  const [prevIsStreaming, setPrevIsStreaming] = useState<boolean>(isStreaming);

  if (isStreaming !== prevIsStreaming) {
    setPrevIsStreaming(isStreaming);
    if (isStreaming) {
      setOpen(true);
    }
  }

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  };

  const hasContent = Boolean(reasoning.content?.trim());

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Collapse thought process' : 'Expand thought process'}
        onPress={toggle}
        hitSlop={6}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.headerLeft}>
          {isStreaming ? (
            <View style={styles.liveDot} />
          ) : (
            <Feather name="cpu" size={13} color={colors.taupe} />
          )}
          <Text style={[styles.headerLabel, isStreaming && styles.headerLabelStreaming]}>
            {isStreaming ? 'Thinking through health context…' : 'Thought process'}
          </Text>
        </View>

        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.taupe}
        />
      </Pressable>

      {open && (
        <View style={styles.body}>
          <View style={styles.leftBar} />
          <View style={styles.contentWrap}>
            {hasContent ? (
              <Text style={styles.contentText}>{reasoning.content.trim()}</Text>
            ) : (
              <Text style={styles.emptyText}>Analyzing medical guidelines…</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xs + 2,
    maxWidth: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: radii.input - 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.pine,
  },
  headerLabel: {
    ...type.caption,
    fontSize: 12,
    color: colors.taupe,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  headerLabelStreaming: {
    color: colors.pine,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  leftBar: {
    width: 2,
    backgroundColor: colors.hairline,
    borderRadius: 1,
  },
  contentWrap: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingVertical: 2,
  },
  contentText: {
    ...type.caption,
    fontSize: 12,
    lineHeight: 18,
    color: colors.taupe,
    fontStyle: 'italic',
  },
  emptyText: {
    ...type.caption,
    fontSize: 12,
    color: colors.taupe,
    fontStyle: 'italic',
    opacity: 0.8,
  },
});
