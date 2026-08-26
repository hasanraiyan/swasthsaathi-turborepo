import Feather from '@expo/vector-icons/Feather';
import type { AgentTodo } from '@repo/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, statusColors, type } from '../../theme';

/**
 * The assistant's plan for the current task.
 *
 * Bare rows on purpose -- no card, no border, no progress bar. A plan is
 * context for what is happening, not a thing in its own right, and giving it
 * chrome would make it compete with the answer it belongs to.
 */
export function TodoChecklist({ todos }: { todos: AgentTodo[] }) {
  if (todos.length === 0) {
    return null;
  }

  return (
    <View style={styles.list} accessibilityLabel={`Plan, ${todos.length} steps`}>
      {todos.map((todo, index) => {
        const done = todo.status === 'completed';
        const active = todo.status === 'in_progress';

        return (
          <View key={`${index}-${todo.content}`} style={styles.row}>
            <View style={styles.icon}>
              {done ? (
                <Feather name="check-circle" size={14} color={statusColors.taken.ink} />
              ) : active ? (
                <Feather name="clock" size={14} color={colors.marigoldText} />
              ) : (
                <Feather name="circle" size={14} color={colors.hairline} />
              )}
            </View>
            <Text
              style={[styles.label, done && styles.done, active && styles.active]}
              numberOfLines={2}
            >
              {todo.content}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 3 },
  icon: { marginTop: 2 },
  label: { ...type.caption, color: colors.taupe, flex: 1 },
  // Struck through and faded: finished, still visible, no longer asking for
  // attention.
  done: { textDecorationLine: 'line-through', color: colors.hairline },
  active: { color: colors.ink, fontWeight: '600' },
});
