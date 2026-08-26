import Feather from '@expo/vector-icons/Feather';
import type { AgentFile } from '@repo/contracts';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '../components/chat/Composer';
import { FileViewer } from '../components/chat/FileViewer';
import { IntentCards } from '../components/chat/IntentCards';
import { ApprovalPrompt, Plan, Thinking, Turn } from '../components/chat/MessageList';
import { useChat } from '../lib/chat-store';
import { useDrawer } from '../lib/navigation';
import { colors, spacing, type } from '../theme';

/**
 * Chat: the app's home screen.
 *
 * Navigation is the top header and the shared side drawer -- there is no
 * bottom bar anywhere in the product, so nothing has to be hidden here.
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const {
    activeConversation,
    turns,
    todos,
    approvals,
    answered,
    pending,
    error,
    draft,
    setDraft,
    sendMessage,
    answerApproval,
    newChat,
    fileAt,
  } = useChat();

  const [openFile, setOpenFile] = useState<AgentFile | null>(null);
  const scroller = useRef<ScrollView>(null);

  const isEmpty = turns.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          onPress={openDrawer}
          hitSlop={10}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Feather name="menu" size={22} color={colors.pine} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeConversation?.title ?? 'New chat'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
          onPress={newChat}
          hitSlop={10}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Feather name="edit" size={20} color={colors.pine} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroller}
          contentContainerStyle={[styles.content, isEmpty && styles.contentEmpty]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (!isEmpty) {
              scroller.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {isEmpty ? (
            <EmptyChat onAsk={setDraft} />
          ) : (
            <View style={styles.thread}>
              {turns.map((turn) => (
                <Turn
                  key={turn.id}
                  turn={turn}
                  onOpenFile={(path) => setOpenFile(fileAt(path))}
                />
              ))}

              {/* Below the turns, not inside one: a plan describes the work
                  still in progress, not something already said. */}
              <Plan todos={todos} />

              {pending ? <Thinking /> : null}

              {approvals.map((approval) => (
                <ApprovalPrompt
                  key={`${approval.index}-${approval.toolName}`}
                  toolName={approval.toolName}
                  description={approval.description}
                  onApprove={() => answerApproval(approval.index, { type: 'approve' })}
                  onReject={() =>
                    answerApproval(approval.index, {
                      type: 'reject',
                      message: 'I would rather you did not do that.',
                    })
                  }
                  // Answered, but still waiting on the others before the run
                  // can be resumed.
                  busy={pending || answered.includes(approval.index)}
                />
              ))}

              {error ? <ErrorNotice message={error} /> : null}
            </View>
          )}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={() => sendMessage(draft)}
            disabled={pending}
          />
        </View>
      </KeyboardAvoidingView>

      <FileViewer file={openFile} onClose={() => setOpenFile(null)} />
    </View>
  );
}

/**
 * What a new chat opens onto: the user's own record, as cards they can act on.
 * Deliberately not a feature tour -- see `lib/intent-cards.ts`.
 */
function EmptyChat({ onAsk }: { onAsk: (prompt: string) => void }) {
  return (
    <View>
      <Text style={styles.emptyTitle}>Your health, at a glance</Text>

      <View style={styles.cards}>
        <IntentCards onAsk={onAsk} />
      </View>
    </View>
  );
}

/**
 * A run that could not finish.
 *
 * In the thread rather than as a toast: it is the answer to what was just
 * asked, and it should stay visible next to the question it belongs to.
 */
function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Feather name="alert-circle" size={14} color={colors.marigoldText} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.title, color: colors.ink, flex: 1, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  content: { paddingVertical: spacing.lg, flexGrow: 1 },
  contentEmpty: { justifyContent: 'center' },
  thread: { paddingHorizontal: spacing.lg },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { ...type.body, color: colors.marigoldText, flex: 1 },
  emptyTitle: {
    ...type.display,
    color: colors.ink,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  cards: { marginBottom: spacing.sm },
  composer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
