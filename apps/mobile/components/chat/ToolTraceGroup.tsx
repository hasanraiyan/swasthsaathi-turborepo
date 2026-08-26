import Feather from '@expo/vector-icons/Feather';
import type { TranscriptToolCall } from '@repo/contracts';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { humanize } from '../../lib/format';
import { colors, spacing, statusColors, type } from '../../theme';
import { ToolTrace } from './ToolTrace';

interface ToolTraceGroupProps {
  calls: TranscriptToolCall[];
  onOpenFile: (filePath: string) => void;
}

/**
 * Several things the assistant did in one breath, shown as one line rather
 * than a wall of rows.
 *
 * Open while any of the calls is still running, so progress stays visible;
 * collapses once they settle, unless the reader already chose otherwise --
 * the same rule a single trace follows, just for the group as a whole.
 */
export function ToolTraceGroup({ calls, onOpenFile }: ToolTraceGroupProps) {
  const [override, setOverride] = useState<boolean | null>(null);
  const anyPending = calls.some((call) => call.result === null);
  const anyError = calls.some((call) => call.isError);
  const open = override ?? anyPending;
  const label = groupLabel(calls);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}${anyError ? ', one failed' : ''}`}
        onPress={() => setOverride(!open)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Feather
          name={anyError ? 'alert-circle' : anyPending ? 'loader' : 'check'}
          size={12}
          color={anyError ? statusColors.missed.ink : anyPending ? colors.taupe : statusColors.taken.ink}
        />
        <Feather name="layers" size={12} color={colors.taupe} />
        <Text style={[styles.label, anyError && styles.failed]} numberOfLines={1}>
          {label}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.hairline} />
      </Pressable>

      {open ? (
        <View style={styles.rows}>
          {calls.map((call) => (
            <ToolTrace key={call.toolCallId} call={call} onOpenFile={onOpenFile} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** "Medicines · 3 steps" when every call shares a domain, else just "3 steps". */
function groupLabel(calls: TranscriptToolCall[]): string {
  const domains = new Set(
    calls.map((call) => (call.toolName.includes('.') ? call.toolName.split('.')[0]! : call.toolName)),
  );
  const steps = `${calls.length} steps`;
  return domains.size === 1 ? `${humanize([...domains][0]!)} · ${steps}` : steps;
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  label: { ...type.caption, color: colors.taupe, flex: 1, fontSize: 12 },
  failed: { color: statusColors.missed.ink },
  rows: {
    marginLeft: spacing.md + 2,
    paddingLeft: spacing.sm,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.hairline,
  },
});
