import Feather from '@expo/vector-icons/Feather';
import type {
  AdherenceSummary,
  DaySchedule,
  HealthSnapshot,
  MeasurementTrend,
  PreventivePlan,
  TranscriptToolCall,
} from '@repo/contracts';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { diffLines, diffStat } from '../../lib/diff';
import { summarizerFor } from '../../lib/domain-records';
import { basename } from '../../lib/file-tool-results';
import { humanize } from '../../lib/format';
import { colors, radii, spacing, statusColors, type } from '../../theme';
import { FilePresentCard } from './FilePresentCard';
import { JsonTree } from './JsonTree';
import { AdherenceCard } from './tool-cards/AdherenceCard';
import { DoseDayCard } from './tool-cards/DoseDayCard';
import { FileDiffCard } from './tool-cards/FileDiffCard';
import { LsResultCard } from './tool-cards/LsResultCard';
import { MeasurementTrendCard } from './tool-cards/MeasurementTrendCard';
import { HealthSnapshotCard, PreventionPlanCard } from './tool-cards/PreventionCards';
import { ReadFileCard } from './tool-cards/ReadFileCard';
import { RecordListCard } from './tool-cards/RecordListCard';
import { RecordRow } from './tool-cards/RecordRow';

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

  // `delete` has nothing to expand into -- deepagents' own result is just
  // "Deleted <path>", and the file's prior content isn't available to show
  // what was lost. A static row says the whole thing; a chevron promising
  // more would be a broken promise.
  if (call.toolName === 'delete') {
    const path = typeof call.args.file_path === 'string' ? call.args.file_path : '';
    return (
      <View style={[styles.wrapper, styles.row]}>
        <Feather
          name={call.isError ? 'alert-circle' : 'trash-2'}
          size={12}
          color={call.isError ? statusColors.missed.ink : colors.taupe}
        />
        <Text style={[styles.label, call.isError && styles.failed]} numberOfLines={1}>
          Deleted {basename(path) || path}
        </Text>
      </View>
    );
  }

  const pending = call.result === null;
  const header = fileHeader(call) ?? { label: describe(call.toolName) };

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${header.label}${call.isError ? ', failed' : ''}`}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Feather
          name={call.isError ? 'alert-circle' : pending ? 'loader' : 'check'}
          size={12}
          color={call.isError ? statusColors.missed.ink : pending ? colors.taupe : statusColors.taken.ink}
        />
        <Text style={[styles.label, call.isError && styles.failed]} numberOfLines={1}>
          {header.label}
        </Text>
        {header.diffstat ? (
          <Text style={styles.diffstat} numberOfLines={1}>
            {header.diffstat.added > 0 ? (
              <Text style={styles.added}>+{header.diffstat.added} </Text>
            ) : null}
            {header.diffstat.removed > 0 ? <Text style={styles.removed}>-{header.diffstat.removed}</Text> : null}
          </Text>
        ) : null}
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.hairline} />
      </Pressable>

      {open ? (
        <View style={styles.detail}>{fileToolBody(call) ?? domainBody(call) ?? genericBody(call)}</View>
      ) : null}
    </View>
  );
}

/** The label and, for a write or an edit, the diffstat next to it. */
function fileHeader(
  call: TranscriptToolCall,
): { label: string; diffstat?: { added: number; removed: number } } | null {
  const args = call.args as Record<string, unknown>;

  switch (call.toolName) {
    case 'ls': {
      const path = typeof args.path === 'string' && args.path ? args.path : '/';
      return { label: `Listed ${path}` };
    }
    case 'read_file': {
      const path = typeof args.file_path === 'string' ? args.file_path : '';
      return { label: `Read ${basename(path) || path}` };
    }
    case 'write_file': {
      const path = typeof args.file_path === 'string' ? args.file_path : '';
      const content = typeof args.content === 'string' ? args.content : '';
      const added = content.length > 0 ? content.split('\n').length : 0;
      return { label: `Wrote ${basename(path) || path}`, diffstat: { added, removed: 0 } };
    }
    case 'edit_file': {
      const path = typeof args.file_path === 'string' ? args.file_path : '';
      const oldString = typeof args.old_string === 'string' ? args.old_string : '';
      const newString = typeof args.new_string === 'string' ? args.new_string : '';
      return { label: `Edited ${basename(path) || path}`, diffstat: diffStat(diffLines(oldString, newString)) };
    }
    default:
      return null;
  }
}

/**
 * The expanded body for a filesystem tool.
 *
 * `write_file` and `edit_file` diff their own arguments and don't need to
 * wait on a result; `ls` and `read_file` have nothing to show until deepagents'
 * result text arrives.
 */
function fileToolBody(call: TranscriptToolCall) {
  const args = call.args as Record<string, unknown>;

  switch (call.toolName) {
    case 'ls':
      return typeof call.result === 'string' ? (
        <LsResultCard path={typeof args.path === 'string' && args.path ? args.path : '/'} raw={call.result} />
      ) : (
        <Text style={styles.pendingText}>Listing…</Text>
      );
    case 'read_file':
      return typeof call.result === 'string' ? (
        <ReadFileCard raw={call.result} />
      ) : (
        <Text style={styles.pendingText}>Reading…</Text>
      );
    case 'write_file':
      return <FileDiffCard mode="write" content={typeof args.content === 'string' ? args.content : ''} />;
    case 'edit_file':
      return (
        <FileDiffCard
          mode="edit"
          oldString={typeof args.old_string === 'string' ? args.old_string : ''}
          newString={typeof args.new_string === 'string' ? args.new_string : ''}
        />
      );
    default:
      return null;
  }
}

/**
 * A domain capability's own result, shown the way the rest of the app shows
 * that data -- not everything gets there: below the two data shapes this
 * checks by name, only a result with more than a bare `{ id }` (what
 * `.delete` returns) is worth a record row over the generic JSON view.
 */
function domainBody(call: TranscriptToolCall) {
  if (typeof call.result !== 'string') {
    return null;
  }
  const parsed = tryParseJson(call.result);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const data = parsed as Record<string, unknown>;

  switch (call.toolName) {
    case 'measurements.trend':
      return <MeasurementTrendCard trend={data as unknown as MeasurementTrend} />;
    case 'medicationDoses.day':
      return <DoseDayCard schedule={data as unknown as DaySchedule} />;
    case 'medicationDoses.adherence':
      return <AdherenceCard summary={data as unknown as AdherenceSummary} />;
    case 'prevention.plan':
      return <PreventionPlanCard plan={data as unknown as PreventivePlan} />;
    case 'prevention.snapshot':
      return <HealthSnapshotCard snapshot={data as unknown as HealthSnapshot} />;
    default: {
      const summarize = summarizerFor(call.toolName);
      if (!summarize) {
        return null;
      }
      if (Array.isArray(data.items)) {
        return <RecordListCard toolName={call.toolName} items={data.items} />;
      }
      return Object.keys(data).length > 1 ? <RecordRow summary={summarize(data)} /> : null;
    }
  }
}

/** Every other tool: raw arguments and result, drilled into as JSON. */
function genericBody(call: TranscriptToolCall) {
  return (
    <>
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
    </>
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
  diffstat: { fontSize: 11, fontFamily: 'monospace' },
  added: { color: statusColors.taken.ink },
  removed: { color: statusColors.missed.ink },
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
  pendingText: { ...type.caption, fontSize: 11, color: colors.taupe, fontStyle: 'italic' },
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
