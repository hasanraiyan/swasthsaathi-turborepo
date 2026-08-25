import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { clockTime, formatDose } from '../../lib/format';
import { useIntentCards, type DoseCard, type IntentCard, type SummaryCard } from '../../lib/intent-cards';
import { useRecordDose } from '../../lib/queries';
import { colors, radii, spacing, statusColors, type } from '../../theme';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';

const GAP = spacing.sm + 4;

/**
 * The empty-chat deck: the user's own record, one card at a time.
 *
 * Doses come through whole rather than summarised -- Taken and Skip work
 * here exactly as they do on Today, so the thing a person opens this app to
 * do can be done without leaving the conversation. The rest of the cards are
 * reads of the record, each with a question to ask or a place to open.
 */
export function IntentCards({ onAsk }: { onAsk: (prompt: string) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { cards, loading, unavailable, refetch } = useIntentCards();
  const record = useRecordDose();
  const [index, setIndex] = useState(0);

  // Leave the next card peeking, so it reads as a deck rather than a page.
  const cardWidth = Math.min(width - spacing.lg * 2 - spacing.xl, 300);
  const stride = cardWidth + GAP;

  if (unavailable) {
    return (
      <View style={styles.singleWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Can't reach your records. Try again."
          onPress={refetch}
          style={({ pressed }) => [styles.card, styles.notice, pressed && styles.pressed]}
        >
          <Text style={styles.headline}>Can&apos;t reach your records</Text>
          <Text style={styles.detail}>Check that the API is running.</Text>
          <View style={styles.actionRow}>
            <Text style={[styles.actionLabel, styles.actionLabelOpen]}>Try again</Text>
            <Feather name="refresh-cw" size={14} color={colors.pine} />
          </View>
        </Pressable>
      </View>
    );
  }

  if (loading && cards.length === 0) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
      >
        {[0, 1, 2].map((placeholder) => (
          <View key={placeholder} style={[styles.card, styles.skeleton, { width: cardWidth }]}>
            <View style={[styles.bar, styles.barShort]} />
            <View style={[styles.bar, styles.barWide]} />
            <View style={[styles.bar, styles.barMid]} />
          </View>
        ))}
      </ScrollView>
    );
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / stride);
    if (next !== index) {
      setIndex(next);
    }
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stride}
        snapToAlignment="start"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.track}
      >
        {cards.map((card: IntentCard) =>
          card.kind === 'dose' ? (
            <DoseIntentCard
              key={card.key}
              card={card}
              width={cardWidth}
              busy={record.isPending && record.variables?.doseId === card.dose.id}
              onRecord={(status) => record.mutate({ doseId: card.dose.id, status })}
            />
          ) : (
            <SummaryIntentCard
              key={card.key}
              card={card}
              width={cardWidth}
              onActivate={() =>
                card.action.kind === 'ask'
                  ? onAsk(card.action.prompt)
                  : router.navigate(card.action.href)
              }
            />
          ),
        )}
      </ScrollView>

      {cards.length > 1 ? (
        <View
          style={styles.dots}
          accessibilityRole="adjustable"
          accessibilityLabel={`Card ${index + 1} of ${cards.length}`}
        >
          {cards.map((card, dotIndex) => (
            <View key={card.key} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A dose, with the same two actions it has on Today.
 *
 * The whole card is not pressable: the buttons are the point, and a stray tap
 * must never be able to mark a medicine taken.
 */
function DoseIntentCard({
  card,
  width,
  busy,
  onRecord,
}: {
  card: DoseCard;
  width: number;
  busy: boolean;
  onRecord: (status: 'taken' | 'skipped') => void;
}) {
  const { dose, due } = card;
  const overdue = dose.status === 'missed';

  return (
    <View style={[styles.card, styles.doseCard, { width }]}>
      <View style={styles.eyebrow}>
        <StatusPill
          status={overdue ? 'missed' : 'pending'}
          label={overdue ? 'Missed' : due ? 'Due now' : 'Upcoming'}
        />
        <Text style={styles.time}>{clockTime(dose.scheduledFor)}</Text>
      </View>

      <Text style={styles.headline} numberOfLines={2}>
        {dose.medicineName}
      </Text>
      <Text style={styles.detail} numberOfLines={2}>
        {formatDose(dose.doseAmount, dose.doseUnit)}
        {dose.medicineStrength ? ` · ${dose.medicineStrength}` : ''}
      </Text>

      <View style={styles.doseActions}>
        <View style={styles.doseAction}>
          <Button label="Taken" size="small" onPress={() => onRecord('taken')} loading={busy} />
        </View>
        <View style={styles.doseAction}>
          <Button
            label="Skip"
            size="small"
            variant="outline"
            onPress={() => onRecord('skipped')}
            disabled={busy}
          />
        </View>
      </View>
    </View>
  );
}

function SummaryIntentCard({
  card,
  width,
  onActivate,
}: {
  card: SummaryCard;
  width: number;
  onActivate: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.section}. ${card.headline}. ${card.action.label}`}
      onPress={onActivate}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.eyebrow}>
        <Feather name={card.icon} size={13} color={colors.taupe} />
        <Text style={styles.section}>{card.section}</Text>
      </View>

      <Text style={styles.headline} numberOfLines={2}>
        {card.headline}
      </Text>
      {card.detail ? (
        <Text style={styles.detail} numberOfLines={2}>
          {card.detail}
        </Text>
      ) : null}

      <View style={styles.actionRow}>
        <Text
          style={[styles.actionLabel, card.action.kind === 'open' && styles.actionLabelOpen]}
          numberOfLines={1}
        >
          {card.action.label}
        </Text>
        <Feather
          // A different mark for a different outcome: one drops a question
          // into the composer, the other leaves the chat.
          name={card.action.kind === 'ask' ? 'corner-down-left' : 'arrow-right'}
          size={14}
          color={card.action.kind === 'ask' ? colors.marigoldText : colors.pine}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Default `alignItems: stretch` on the row makes every card match the
  // tallest, so a dose card with buttons doesn't leave the others short.
  track: { paddingHorizontal: spacing.lg, gap: GAP, paddingVertical: spacing.xs },
  singleWrap: { paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: 156,
  },
  // A dose is the one card here that is time-bound, so it carries a warmer
  // edge than the reads around it.
  doseCard: { borderColor: statusColors.pending.ink, borderWidth: 1 },
  notice: { borderStyle: 'dashed', borderColor: colors.border },
  pressed: { opacity: 0.85 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  section: { ...type.label, color: colors.taupe, textTransform: 'uppercase', fontSize: 11 },
  time: { ...type.label, color: colors.marigoldText },
  headline: { ...type.title, color: colors.ink, marginTop: spacing.sm },
  detail: { ...type.caption, color: colors.taupe, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  actionLabel: { ...type.caption, color: colors.marigoldText, fontWeight: '600', flex: 1 },
  actionLabelOpen: { color: colors.pine },
  doseActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 'auto', paddingTop: spacing.md },
  doseAction: { flex: 1 },
  skeleton: { justifyContent: 'center', gap: spacing.sm },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.hairline },
  barShort: { width: '35%' },
  barWide: { width: '80%', height: 16 },
  barMid: { width: '55%' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairline },
  dotActive: { backgroundColor: colors.pine, width: 18 },
});
