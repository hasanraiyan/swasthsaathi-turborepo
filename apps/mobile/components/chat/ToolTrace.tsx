import Feather from '@expo/vector-icons/Feather';
import type { TranscriptToolCall } from '@repo/contracts';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { humanize } from '../../lib/format';
import { colors, radii, spacing, statusColors, type } from '../../theme';
import { FilePresentCard } from './FilePresentCard';
import { JsonTree } from './JsonTree';

interface ToolTraceProps {
  call: TranscriptToolCall;
  onOpenFile: (filePath: string) => void;
}

/**
 * One thing the assistant did, shown as evidence rather than decoration.
 *
 * Collapsed by default: in normal use the answer is what matters and the
 * mechanics are noise. But it stays *reachable*, because this assistant reads
 * and writes a health record, and "which of my medicines did it actually
 * look at" has to be answerable without trusting the prose.
 */
export function ToolTrace({ call, onOpenFile }: ToolTraceProps) {
  const [open, setOpen] = useState(false);

  // `present_file` is not really a tool call to the reader -- it is the file
  // arriving. Showing it as one would bury the thing they are meant to open.
  if (call.toolName === 'present_file') {
    const args = call.args as { filePath?: string; title?: string; description?: string };
    if (args.filePath) {
      return (
        <FilePresentCard
          filePath={args.filePath}
          title={args.title}
          description={args.description}
          onOpen={onOpenFile}
        />
      );
    }
  }

  // The plan is already drawn as a checklist that updates as the agent works
  // through it. A row saying it was written again says nothing the reader
  // cannot already see.
  if (call.toolName === 'write_todos') {
    return null;
  }

  const pending = call.result === null;
  const label = describe(call.toolName);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}${call.isError ? ', failed' : ''}`}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Feather
          name={call.isError ? 'alert-circle' : pending ? 'loader' : 'check'}
          size={12}
          color={call.isError ? statusColors.missed.ink : pending ? colors.taupe : statusColors.taken.ink}
        />
        <Text style={[styles.label, call.isError && styles.failed]} numberOfLines={1}>
          {label}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.hairline} />
      </Pressable>

      {open ? (
        <View style={styles.detail}>
          {Object.keys(call.args).length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Arguments</Text>
              <JsonTree value={call.args} />
            </View>
          ) : null}
          {call.result ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Result</Text>
              <ResultView content={call.result} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A tool's result, drilled into like the arguments above it.
 *
 * Every capability returns JSON -- confirmed in `tool-adapter.ts`, which
 * always `JSON.stringify`s the call's outcome -- so this only falls back to
 * plain text for a shape that changed underneath it, not as the normal path.
 */
function ResultView({ content }: { content: string }) {
  const parsed = tryParseJson(content);
  if (parsed !== undefined) {
    return <JsonTree value={parsed} />;
  }
  return (
    <Text style={[styles.mono, styles.result]} numberOfLines={10}>
      {content}
    </Text>
  );
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** `medicines.list` reads as "Medicines · list" rather than a symbol. */
function describe(toolName: string): string {
  const [domain, action] = toolName.split('.');
  if (!action) {
    return humanize(toolName);
  }
  return `${humanize(domain ?? '')} · ${action.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  label: { ...type.caption, color: colors.taupe, flex: 1, fontSize: 12 },
  failed: { color: statusColors.missed.ink },
  detail: {
    marginLeft: spacing.md + 2,
    paddingLeft: spacing.sm,
    // A hairline rule instead of a box: it ties the detail to its row without
    // turning a debugging aid into another card in the thread.
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.hairline,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  section: { gap: 2 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.hairline,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mono: {
    ...type.caption,
    fontSize: 11,
    color: colors.taupe,
    fontFamily: 'monospace',
  },
  result: {
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radii.input - 6,
    padding: spacing.sm,
  },
});
