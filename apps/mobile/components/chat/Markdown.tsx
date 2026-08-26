import { Fragment } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { parseInline, parseMarkdown, type InlineSegment, type MarkdownBlock } from '../../lib/markdown';
import { colors, spacing, type } from '../../theme';

/**
 * A file the assistant wrote, rendered rather than shown as raw syntax.
 *
 * Reads `parseMarkdown`'s own comment for why this is a scoped renderer, not
 * a general one: every file here comes from `write_file`/`edit_file` on this
 * agent, never an external source, so the realistic shape is headings, bold,
 * lists, a quote or a rule -- not tables or embedded HTML.
 */
export function Markdown({ content }: { content: string }) {
  const blocks = parseMarkdown(content);
  return (
    <View>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </View>
  );
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Text selectable style={[styles.heading, headingStyle(block.level)]}>
          <Inline segments={parseInline(block.text)} />
        </Text>
      );
    case 'paragraph':
      return (
        <Text selectable style={styles.paragraph}>
          <Inline segments={parseInline(block.text)} />
        </Text>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, index) => (
            <View key={index} style={styles.listRow}>
              <Text style={styles.listMarker}>{block.ordered ? `${index + 1}.` : '•'}</Text>
              <Text selectable style={styles.listText}>
                <Inline segments={parseInline(item)} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <View style={styles.quote}>
          <Text selectable style={styles.quoteText}>
            <Inline segments={parseInline(block.text)} />
          </Text>
        </View>
      );
    case 'rule':
      return <View style={styles.rule} />;
    case 'code':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeBlock}>
          <Text style={styles.codeText} selectable>
            {block.text}
          </Text>
        </ScrollView>
      );
  }
}

function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <Fragment>
      {segments.map((segment, index) =>
        segment.href ? (
          <Text
            key={index}
            style={styles.link}
            onPress={() => {
              void Linking.openURL(segment.href!);
            }}
          >
            {segment.text}
          </Text>
        ) : (
          <Text
            key={index}
            style={[
              segment.bold && styles.bold,
              segment.italic && styles.italic,
              segment.code && styles.inlineCode,
            ]}
          >
            {segment.text}
          </Text>
        ),
      )}
    </Fragment>
  );
}

/**
 * H1/H2 in the app's own display face; H3 and deeper in the system face,
 * just bolder and a step down in size each time. A memory note rarely nests
 * past three levels, so the scale stops differentiating there rather than
 * shrinking text past the point of being worth reading.
 */
function headingStyle(level: number) {
  if (level === 1) {
    return { fontFamily: 'Baloo2_700Bold', fontSize: 22, lineHeight: 28 };
  }
  if (level === 2) {
    return { fontFamily: 'Baloo2_700Bold', fontSize: 19, lineHeight: 25 };
  }
  const size = level === 3 ? 17 : 15;
  return { fontWeight: '700' as const, fontSize: size, lineHeight: size + 6 };
}

const styles = StyleSheet.create({
  heading: { color: colors.ink, marginTop: spacing.md, marginBottom: spacing.xs },
  paragraph: { ...type.body, color: colors.ink, lineHeight: 24, marginBottom: spacing.sm },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 14,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  link: { color: colors.marigoldText, textDecorationLine: 'underline' },

  list: { marginBottom: spacing.sm },
  listRow: { flexDirection: 'row', gap: spacing.xs + 2, marginBottom: 2 },
  listMarker: { ...type.body, color: colors.taupe, width: 20 },
  listText: { ...type.body, color: colors.ink, lineHeight: 24, flex: 1 },

  quote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  quoteText: { ...type.body, color: colors.taupe, fontStyle: 'italic', lineHeight: 24 },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: spacing.md },

  codeBlock: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  codeText: { fontFamily: 'monospace', fontSize: 13, color: colors.ink },
});
