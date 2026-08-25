import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, type } from '../../theme';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Pull-to-refresh. Omit on screens with nothing to refetch. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pinned below the scrolling content, e.g. a save button. */
  footer?: ReactNode;
}

/**
 * The frame every screen sits in: safe areas, a display-face heading, and
 * pull-to-refresh where the screen has server data.
 */
export function Screen({
  title,
  subtitle,
  children,
  onRefresh,
  refreshing = false,
  footer,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
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
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  header: { marginBottom: spacing.lg },
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
