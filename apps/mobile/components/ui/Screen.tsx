import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrawer } from '../../lib/navigation';
import { colors, spacing, type } from '../../theme';
import { ThreadRule } from './ThreadRule';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Pull-to-refresh. Omit on screens with nothing to refetch. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pinned below the scrolling content, e.g. a save button. */
  footer?: ReactNode;
  /**
   * Show the drawer button. Set on the primary sections; sub-pages leave it
   * off and rely on the stack's back arrow instead.
   */
  menu?: boolean;
}

/**
 * The frame every screen sits in: safe areas, the drawer button on primary
 * sections, a display-face heading, and pull-to-refresh where there is server
 * data behind it.
 */
export function Screen({
  title,
  subtitle,
  children,
  onRefresh,
  refreshing = false,
  footer,
  menu = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {menu ? (
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            onPress={openDrawer}
            hitSlop={10}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          >
            <Feather name="menu" size={22} color={colors.pine} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.pine}
              colors={[colors.pine]}
            />
          ) : undefined
        }
      >
        {title ? (
          <View style={styles.header}>
            <ThreadRule style={styles.headerRule} />
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  topBar: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  header: { marginBottom: spacing.lg },
  headerRule: { marginBottom: spacing.sm },
  title: { ...type.display, color: colors.ink },
  subtitle: { ...type.body, color: colors.taupe, marginTop: spacing.xs },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
