import Feather from '@expo/vector-icons/Feather';
import { useRef } from 'react';
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
import { IntentCards } from '../components/chat/IntentCards';
import { MessageBubble, TypingIndicator } from '../components/chat/MessageList';
import { useChat } from '../lib/chat-store';
import { useDrawer } from '../lib/navigation';
import { colors, spacing, type } from '../theme';

/**
 * Chat: the app's home screen.
 *
 * Navigation is the top header and the shared side drawer -- there is no
 * bottom bar anywhere in the product any more, so nothing has to be hidden
 * here.
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { activeConversation, pending, draft, setDraft, sendMessage, newChat } = useChat();

  const scroller = useRef<ScrollView>(null);
  const messages = activeConversation?.messages ?? [];
  const isEmpty = messages.length === 0;

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
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {pending ? <TypingIndicator /> : null}
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
      <View style={styles.badge}>
        <Feather name="clock" size={12} color={colors.marigoldText} />
        <Text style={styles.badgeText}>Preview — the assistant isn&apos;t connected yet</Text>
      </View>

      <Text style={styles.emptyTitle}>Your health, at a glance</Text>

      <View style={styles.cards}>
        <IntentCards onAsk={onAsk} />
      </View>
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  badgeText: { ...type.caption, color: colors.marigoldText, fontWeight: '600' },
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
