import Feather from '@expo/vector-icons/Feather';
import type { AgentFile } from '@repo/contracts';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, type } from '../../theme';
import { Markdown } from './Markdown';

/**
 * Reads a file the assistant wrote.
 *
 * Full screen rather than a sheet: what lands here is meant to be read
 * properly and often taken to an appointment, not glanced at over the top of
 * the conversation.
 */
export function FileViewer({ file, onClose }: { file: AgentFile | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  if (!file) {
    return null;
  }
  const name = file.path.split('/').pop() ?? file.path;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.path} numberOfLines={1}>
              {file.path}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Feather name="x" size={20} color={colors.taupe} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          <Markdown content={file.content} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: { ...type.title, color: colors.ink },
  path: { ...type.caption, color: colors.taupe, fontSize: 11, marginTop: 1 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  body: { padding: spacing.lg },
});
