import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card, CardMeta, CardTitle } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { useVoiceCalls } from '../lib/queries';
import { colors, spacing, type } from '../theme';

/** Past voice calls: when, how long, and -- expanded -- what was said. */
export default function CallsScreen() {
  const calls = useVoiceCalls();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Screen
      title="Calls"
      subtitle="Voice conversations with your assistant"
      onRefresh={() => void calls.refetch()}
      refreshing={calls.isRefetching}
    >
      {calls.data?.items.length === 0 ? (
        <Text style={styles.empty}>No calls yet.</Text>
      ) : (
        calls.data?.items.map((call) => {
          const open = openId === call.id;
          const duration = call.endedAt
            ? durationLabel(new Date(call.startedAt), new Date(call.endedAt))
            : null;
          return (
            <Card
              key={call.id}
              onPress={() => setOpenId(open ? null : call.id)}
              accessibilityLabel={`Call started ${formatWhen(call.startedAt)}`}
            >
              <CardTitle>{formatWhen(call.startedAt)}</CardTitle>
              <CardMeta>
                {duration ?? 'In progress'} · {call.turns.length} turn
                {call.turns.length === 1 ? '' : 's'}
              </CardMeta>
              {open
                ? call.turns.map((turn, index) => (
                    <Text
                      key={index}
                      style={[
                        styles.turn,
                        turn.role === 'user' ? styles.userTurn : styles.assistantTurn,
                      ]}
                    >
                      {turn.text}
                    </Text>
                  ))
                : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function durationLabel(start: Date, end: Date): string {
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

const styles = StyleSheet.create({
  empty: { ...type.body, color: colors.taupe, marginTop: spacing.lg },
  turn: { ...type.caption, marginTop: spacing.sm },
  userTurn: { color: colors.taupe, textAlign: 'right' },
  assistantTurn: { color: colors.ink },
});
