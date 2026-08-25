import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardMeta, CardTitle } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../../components/ui/States';
import { useLogSymptom, useSymptoms } from '../../lib/queries';
import { colors, spacing, type } from '../../theme';

const SEVERITIES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export default function SymptomsScreen() {
  const symptoms = useSymptoms();
  const log = useLogSymptom();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('5');
  const [notes, setNotes] = useState('');

  function save() {
    log.mutate(
      { name: name.trim(), severity: Number(severity), notes: notes.trim() || null, triggers: [] },
      {
        onSuccess: () => {
          setOpen(false);
          setName('');
          setNotes('');
          setSeverity('5');
        },
      },
    );
  }

  return (
    <Screen
      onRefresh={() => void symptoms.refetch()}
      refreshing={symptoms.isRefetching}
      footer={open ? undefined : <Button label="Log a symptom" onPress={() => setOpen(true)} />}
    >
      {open ? (
        <View style={styles.form}>
          {log.isError ? <ErrorNotice error={log.error} /> : null}
          <Field
            label="What are you feeling"
            value={name}
            onChangeText={setName}
            placeholder="Headache"
          />
          <ChipGroup label="How bad, 1 to 10" options={SEVERITIES} value={severity} onChange={setSeverity} />
          <Text style={styles.scale}>1 is barely noticeable, 10 is the worst imaginable.</Text>
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button label="Cancel" onPress={() => setOpen(false)} variant="ghost" />
            </View>
            <View style={styles.grow}>
              <Button
                label="Save"
                onPress={save}
                disabled={name.trim().length === 0 || log.isPending}
                loading={log.isPending}
              />
            </View>
          </View>
        </View>
      ) : null}

      {symptoms.isPending ? <Loading /> : null}
      {symptoms.isError ? (
        <ErrorNotice error={symptoms.error} onRetry={() => void symptoms.refetch()} />
      ) : null}

      {!open && symptoms.data?.items.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          body="Logging how you feel builds a pattern over time — the kind of thing worth showing a doctor."
          actionLabel="Log a symptom"
          onAction={() => setOpen(true)}
        />
      ) : null}

      {symptoms.data?.items.map((entry) => (
        <Card key={entry.id}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <CardTitle>{entry.name}</CardTitle>
              <CardMeta>{formatWhen(entry.startedAt)}</CardMeta>
              {entry.notes ? <CardMeta>{entry.notes}</CardMeta> : null}
            </View>
            <View style={styles.severity}>
              <Text style={styles.severityValue}>{entry.severity}</Text>
              <Text style={styles.severityScale}>/10</Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  form: { marginBottom: spacing.lg },
  scale: { ...type.caption, color: colors.taupe, marginTop: -spacing.sm, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
  severity: { flexDirection: 'row', alignItems: 'baseline' },
  severityValue: { ...type.title, color: colors.marigoldText },
  severityScale: { ...type.caption, color: colors.taupe },
});
