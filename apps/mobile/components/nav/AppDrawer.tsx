import { useAuth } from '@clerk/expo';
import Feather from '@expo/vector-icons/Feather';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { groupConversations, useChat, type Conversation } from '../../lib/chat-store';
import { NAV_SECTIONS, isSectionActive, useDrawer } from '../../lib/navigation';
import { colors, radii, spacing, statusColors, type, webOutlineReset } from '../../theme';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ThreadRule } from '../ui/ThreadRule';

/**
 * The app's primary navigation: sections, plus the chat's own new-chat action
 * and history.
 *
 * One drawer for the whole product rather than one per area -- the sections
 * and the conversations are reachable from the same panel wherever you are,
 * which is what keeps this from becoming two competing navigation systems.
 *
 * Hand-built on `Animated` and `PanResponder` rather than
 * `@react-navigation/drawer`, which would pull in `react-native-reanimated`
 * and `react-native-gesture-handler`. Both are native modules, so adding them
 * would invalidate the existing development build and release APK for a panel
 * that is a translate and a scrim.
 */
export function AppDrawer() {
  const { open, closeDrawer } = useDrawer();
  const { isSignedIn } = useAuth();

  // Mounting only while open means the panel starts each time from a fresh
  // animation value, with no separate "is it still closing" state to keep in
  // step with the prop.
  if (!open || !isSignedIn) {
    return null;
  }
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={closeDrawer}>
      <DrawerPanel />
    </Modal>
  );
}

function DrawerPanel() {
  const { closeDrawer } = useDrawer();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const {
    conversations,
    activeConversation,
    newChat,
    selectConversation,
    renameConversation,
    deleteConversation,
  } = useChat();

  // Which conversation's "..." menu is open, and which dialog (if any) it led
  // to. One at a time -- a second menu opening always means the first closed.
  const [menuFor, setMenuFor] = useState<Conversation | null>(null);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [deletingConversation, setDeletingConversation] = useState<Conversation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deletingConversation) {
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteConversation(deletingConversation.id);
      setDeletingConversation(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Could not delete. Try again.');
    } finally {
      setDeleteBusy(false);
    }
  }

  // Roomy enough for a conversation title, never so wide it hides the page.
  const drawerWidth = Math.min(330, width * 0.86);

  // Lazy `useState` rather than `useRef`: stable for the panel's life, and
  // read during render to build the transform, which a ref is not meant for.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [progress]);

  /** Slide out first, then let the provider unmount us. */
  const requestClose = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: 170, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) {
          closeDrawer();
        }
      },
    );
  }, [closeDrawer, progress]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dx < -6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: (_event, gesture) => {
          progress.setValue(Math.max(0, Math.min(1, (drawerWidth + gesture.dx) / drawerWidth)));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -drawerWidth * 0.35 || gesture.vx < -0.5) {
            requestClose();
          } else {
            Animated.timing(progress, {
              toValue: 1,
              duration: 140,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [drawerWidth, requestClose, progress],
  );

  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });
  const scrimOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  function choose(action: () => void) {
    action();
    requestClose();
  }

  /**
   * `navigate` rather than `push`: returning to a section already in the stack
   * pops back to it instead of stacking another copy of it.
   */
  function goTo(href: string) {
    choose(() => router.navigate(href));
  }

  function openConversation(id: string) {
    choose(() => {
      selectConversation(id);
      router.navigate('/');
    });
  }

  return (
    <View style={styles.fill}>
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <Pressable
          style={styles.fill}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={requestClose}
        />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            transform: [{ translateX }],
            paddingTop: insets.top + spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>
            <Text style={styles.brandPine}>Swasth</Text>
            <Text style={styles.brandGold}>Saathi</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={requestClose}
            hitSlop={10}
          >
            <Feather name="x" size={20} color={colors.taupe} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            choose(() => {
              newChat();
              router.navigate('/');
            })
          }
          style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}
        >
          <Feather name="edit" size={16} color={colors.cream} />
          <Text style={styles.newChatLabel}>New chat</Text>
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.nav}>
            {NAV_SECTIONS.map((section) => {
              const active = isSectionActive(pathname, section.href);
              return (
                <Pressable
                  key={section.href}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={section.label}
                  onPress={() => goTo(section.href)}
                  style={({ pressed }) => [
                    styles.navRow,
                    active && styles.navRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.navMark}>{active ? <ThreadRule orientation="vertical" /> : null}</View>
                  <Feather
                    name={section.icon}
                    size={18}
                    color={active ? colors.pine : colors.taupe}
                  />
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {section.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.groupLabel}>Recent chats</Text>
          {groups.length === 0 ? (
            <Text style={styles.empty}>
              No conversations yet. Anything you ask will be listed here.
            </Text>
          ) : (
            groups.map((group) => (
              <View key={group.label}>
                <Text style={styles.timeLabel}>{group.label}</Text>
                {group.items.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === activeConversation?.id && pathname === '/'}
                    onPress={() => openConversation(conversation.id)}
                    onMenu={() => setMenuFor(conversation)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>

      {menuFor ? (
        <ConversationMenu
          conversation={menuFor}
          onClose={() => setMenuFor(null)}
          onRename={() => {
            setMenuFor(null);
            setRenaming(menuFor);
          }}
          onDelete={() => {
            setMenuFor(null);
            setDeleteError(null);
            setDeletingConversation(menuFor);
          }}
        />
      ) : null}

      {renaming ? (
        <RenameDialog
          conversation={renaming}
          onClose={() => setRenaming(null)}
          onRename={renameConversation}
        />
      ) : null}

      <ConfirmDialog
        visible={deletingConversation !== null}
        title="Delete this conversation?"
        body={deleteError ?? "This can't be undone."}
        confirmLabel="Delete"
        destructive
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletingConversation(null)}
      />
    </View>
  );
}

function ConversationRow({
  conversation,
  active,
  onPress,
  onMenu,
}: {
  conversation: Conversation;
  active: boolean;
  onPress: () => void;
  onMenu: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={conversation.title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        {/* Title only: the session list is a list of names, and the API names
            each conversation from its first message. */}
        <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>
          {conversation.title}
        </Text>
      </View>
      <Text style={styles.rowTime}>{shortTime(conversation.updatedAt)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More options for ${conversation.title}`}
        hitSlop={8}
        onPress={(event: GestureResponderEvent) => {
          // Stops the tap from also opening the conversation underneath --
          // real DOM click bubbling on web, not just RN's own responder.
          event.stopPropagation();
          onMenu();
        }}
        style={({ pressed }) => [styles.rowMenuButton, pressed && styles.pressed]}
      >
        <Feather name="more-horizontal" size={16} color={colors.taupe} />
      </Pressable>
    </Pressable>
  );
}

/** Rename or delete, for one conversation. */
function ConversationMenu({
  conversation,
  onClose,
  onRename,
  onDelete,
}: {
  conversation: Conversation;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss" onPress={onClose} />
        <View style={styles.menuCard}>
          <Text style={styles.menuTitle} numberOfLines={1}>
            {conversation.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRename}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          >
            <Feather name="edit-2" size={16} color={colors.ink} />
            <Text style={styles.menuRowLabel}>Rename</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          >
            <Feather name="trash-2" size={16} color={statusColors.missed.ink} />
            <Text style={[styles.menuRowLabel, styles.menuRowDanger]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** A conversation's title, edited in place. */
function RenameDialog({
  conversation,
  onClose,
  onRename,
}: {
  conversation: Conversation;
  onClose: () => void;
  onRename: (id: string, title: string) => Promise<void>;
}) {
  const [value, setValue] = useState(conversation.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();

  async function save() {
    if (!trimmed) {
      return;
    }
    if (trimmed === conversation.title) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(conversation.id, trimmed);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={busy ? () => undefined : onClose}
    >
      <View style={styles.dialogOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss"
          onPress={busy ? undefined : onClose}
        />
        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>Rename conversation</Text>
          <TextInput
            accessibilityLabel="Conversation title"
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={200}
            onSubmitEditing={() => void save()}
            returnKeyType="done"
            style={[styles.renameInput, webOutlineReset]}
          />
          {error ? <Text style={styles.dialogError}>{error}</Text> : null}
          <View style={styles.dialogActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              disabled={busy}
              style={({ pressed }) => [styles.dialogButton, pressed && styles.pressed]}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void save()}
              disabled={busy || trimmed.length === 0}
              style={({ pressed }) => [
                styles.dialogButton,
                styles.dialogConfirmButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dialogConfirmText}>{busy ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Time for today, weekday within the week, date beyond that. */
function shortTime(iso: string): string {
  const date = new Date(iso);
  const age = Date.now() - date.getTime();
  if (age < 86_400_000) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (age < 7 * 86_400_000) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.ink,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.cream,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.hairline,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  brand: { ...type.title },
  brandPine: { color: colors.pine },
  brandGold: { color: colors.marigoldText },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pine,
    borderRadius: radii.button,
    minHeight: 46,
  },
  newChatLabel: { ...type.body, fontWeight: '600', color: colors.cream },
  pressed: { opacity: 0.75 },
  scroll: { flex: 1, marginTop: spacing.md },
  scrollContent: { paddingBottom: spacing.md },
  nav: {
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.input,
  },
  navRowActive: { backgroundColor: colors.surface },
  navMark: { width: 3, alignItems: 'center' },
  navLabel: { ...type.body, color: colors.taupe },
  navLabelActive: { color: colors.pine, fontWeight: '600' },
  groupLabel: {
    ...type.label,
    color: colors.taupe,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  timeLabel: { ...type.caption, color: colors.taupe, marginTop: spacing.sm, marginLeft: spacing.sm },
  empty: { ...type.caption, color: colors.taupe, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.input,
  },
  rowActive: { backgroundColor: colors.surface },
  rowText: { flex: 1 },
  rowTitle: { ...type.body, color: colors.ink },
  rowTitleActive: { fontWeight: '600' },
  rowTime: { ...type.caption, color: colors.taupe },
  rowMenuButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  dialogOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 38, 32, 0.45)',
    padding: spacing.lg,
  },
  menuCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.cream,
    borderRadius: radii.input,
    padding: spacing.md,
  },
  menuTitle: {
    ...type.label,
    color: colors.taupe,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.input - 4,
  },
  menuRowLabel: { ...type.body, color: colors.ink },
  menuRowDanger: { color: statusColors.missed.ink },

  renameInput: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginTop: spacing.xs,
  },
  dialogError: { ...type.caption, color: statusColors.missed.ink, marginTop: spacing.xs },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dialogButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radii.button },
  dialogCancelText: { ...type.body, fontWeight: '600', color: colors.taupe },
  dialogConfirmButton: { backgroundColor: colors.pine },
  dialogConfirmText: { ...type.body, fontWeight: '600', color: colors.cream },
});
