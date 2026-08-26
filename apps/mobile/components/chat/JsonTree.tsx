import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '../../theme';

interface JsonTreeProps {
  value: unknown;
  /** The root's own entries are always visible; anything nested starts folded. */
  depth?: number;
}

/**
 * A JSON value as something to explore rather than a wall of text.
 *
 * The root is always open -- there is already a fold controlling whether this
 * shows at all, so folding it again would be one tap too many. Everything
 * nested starts collapsed behind a one-line preview, since a `medicines.list`
 * result is mostly an array of records nobody is reading in full at a glance.
 */
export function JsonTree({ value, depth = 0 }: JsonTreeProps) {
  if (Array.isArray(value)) {
    return (
      <View style={depth > 0 ? styles.indent : undefined}>
        {value.length === 0 ? (
          <Text style={styles.empty}>[ ]</Text>
        ) : (
          value.map((item, index) => <Entry key={index} label={`[${index}]`} value={item} depth={depth} />)
        )}
      </View>
    );
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <View style={depth > 0 ? styles.indent : undefined}>
        {entries.length === 0 ? (
          <Text style={styles.empty}>{'{ }'}</Text>
        ) : (
          entries.map(([key, item]) => <Entry key={key} label={key} value={item} depth={depth} />)
        )}
      </View>
    );
  }

  return <Text style={styles.scalar}>{scalarText(value)}</Text>;
}

function Entry({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const nested = value !== null && typeof value === 'object';

  if (!nested) {
    return (
      <View style={styles.row}>
        <Text style={styles.key}>{label}:</Text>
        <Text style={styles.scalar} numberOfLines={3}>
          {scalarText(value)}
        </Text>
      </View>
    );
  }

  return <NestedEntry label={label} value={value} depth={depth} />;
}

function NestedEntry({ label, value, depth }: { label: string; value: object; depth: number }) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Feather name={open ? 'chevron-down' : 'chevron-right'} size={11} color={colors.hairline} />
        <Text style={styles.key}>{label}:</Text>
        <Text style={styles.preview}>{preview(value)}</Text>
      </Pressable>
      {open ? <JsonTree value={value} depth={depth + 1} /> : null}
    </View>
  );
}

function preview(value: object): string {
  if (Array.isArray(value)) {
    return value.length === 1 ? '[ 1 item ]' : `[ ${value.length} items ]`;
  }
  const count = Object.keys(value).length;
  return count === 1 ? '{ 1 key }' : `{ ${count} keys }`;
}

function scalarText(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}

const styles = StyleSheet.create({
  indent: {
    marginLeft: spacing.sm,
    paddingLeft: spacing.xs,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.hairline,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 1 },
  pressed: { opacity: 0.6 },
  key: { fontSize: 11, fontFamily: 'monospace', color: colors.taupe },
  scalar: { fontSize: 11, fontFamily: 'monospace', color: colors.ink, flexShrink: 1 },
  preview: { fontSize: 11, fontFamily: 'monospace', color: colors.taupe, fontStyle: 'italic' },
  empty: { ...type.caption, fontSize: 11, color: colors.hairline, fontFamily: 'monospace' },
});
