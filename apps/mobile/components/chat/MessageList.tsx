import Feather from '@expo/vector-icons/Feather';
import type { AgentTodo, TranscriptTurn } from '@repo/contracts';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '../../theme';
import { TodoChecklist } from './TodoChecklist';
import { ToolTrace } from './ToolTrace';

interface TurnProps {
  turn: TranscriptTurn;
  onOpenFile: (filePath: string) => void;
}

/**
 * One turn in the conversation.
 *
 * The assistant gets no bubble and no avatar -- its words sit directly on the
 * page. Only what the user said is boxed, which is enough to tell the two
 * apart and leaves the assistant's answer reading as the page's own content
 * rather than as something being handed across a table. It also means the
 * tool traces and any file it produced become the objects in the thread,
 * which is what someone is actually scanning for.
 */
export function Turn({ turn, onOpenFile }: TurnProps) {
  if (turn.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{turn.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistant}>
      {/* Above the text: the work happened before the answer did. */}
      {turn.toolCalls.map((call) => (
        <ToolTrace key={call.toolCallId} call={call} onOpenFile={onOpenFile} />
      ))}
      {turn.content.trim() ? <Text style={styles.assistantText}>{turn.content}</Text> : null}
    </View>
  );
}

/** The assistant's plan, when it is working through one. */
export function Plan({ todos }: { todos: AgentTodo[] }) {
  return <TodoChecklist todos={todos} />;
}

/**
 * Shown while a reply is being waited on.
 *
 * Three dots and nothing else -- no bubble, matching the answer that will
 * replace them, so nothing shifts when it arrives.
 */
export function Thinking() {
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
    <View style={styles.thinking} accessibilityLabel="Thinking">
      {[0, 1, 2].map((dot) => (
        <Animated.View
          key={dot}
          style={[
            styles.dot,
            {
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                // Staggered, so the three read as a wave rather than a blink.
                outputRange: dot === 1 ? [0.6, 0.2] : [0.2, 0.6],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * A write the assistant has stopped on.
 *
 * Deliberately the loudest thing in the thread: it is the one moment the
 * conversation is asking permission to change a health record, and it must
 * not read as another message.
 */
export function ApprovalPrompt({
  toolName,
  description,
  onApprove,
  onReject,
  busy,
}: {
  toolName: string;
  description: string | null;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.approval}>
      <View style={styles.approvalHead}>
        <Feather name="shield" size={14} color={colors.marigoldText} />
        <Text style={styles.approvalTitle}>Needs your go-ahead</Text>
      </View>
      <Text style={styles.approvalBody}>{description ?? 'This will change your health record.'}</Text>
      <Text style={styles.approvalTool}>{toolName}</Text>

      <View style={styles.approvalActions}>
        <ApprovalButton label="Allow" onPress={onApprove} disabled={busy} primary />
        <ApprovalButton label="Not now" onPress={onReject} disabled={busy} />
      </View>
    </View>
  );
}

function ApprovalButton({
  label,
  onPress,
  disabled,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <Text
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={[styles.approvalButton, primary ? styles.approvalPrimary : styles.approvalGhost]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.md },
  userBubble: {
    maxWidth: '86%',
    backgroundColor: colors.pine,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  userText: { ...type.body, color: colors.cream },

  // No background, no border, no avatar: the answer is the page.
  assistant: { marginBottom: spacing.lg },
  assistantText: { ...type.body, color: colors.ink, lineHeight: 24, marginTop: spacing.xs },

  thinking: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.taupe },

  approval: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.marigold,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  approvalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  approvalTitle: { ...type.label, color: colors.marigoldText },
  approvalBody: { ...type.body, color: colors.ink, marginTop: spacing.xs },
  approvalTool: { ...type.caption, color: colors.taupe, fontFamily: 'monospace', marginTop: 2 },
  approvalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  approvalButton: {
    ...type.caption,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  approvalPrimary: { backgroundColor: colors.pine, color: colors.cream },
  approvalGhost: { color: colors.taupe, borderWidth: 1, borderColor: colors.border },
});
