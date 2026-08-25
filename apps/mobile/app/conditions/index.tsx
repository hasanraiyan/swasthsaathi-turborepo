import { CONDITION_SEVERITY, CONDITION_STATUS } from '@repo/contracts';
import type { ConditionSeverity, ConditionStatus } from '@repo/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardMeta, CardTitle } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { humanize } from '../../lib/format';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../../components/ui/States';
import { StatusPill } from '../../components/ui/StatusPill';
import { useConditions, useCreateCondition } from '../../lib/queries';
import { spacing } from '../../theme';

export default function ConditionsScreen() {
  const conditions = useConditions();
  const create = useCreateCondition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ConditionStatus>('active');
  const [severity, setSeverity] = useState<ConditionSeverity>('mild');
  const [notes, setNotes] = useState('');

  function save() {
    create.mutate(
      { name: name.trim(), status, severity, notes: notes.trim() || null },
      {
        onSuccess: () => {
          setOpen(false);
          setName('');
          setNotes('');
        },
      },
    );
  }

  return (
    <Screen
      onRefresh={() => void conditions.refetch()}
      refreshing={conditions.isRefetching}
      footer={
        open ? undefined : (
          <Button label="Add condition" onPress={() => setOpen(true)} />
        )
      }
    >
      {open ? (
        <View style={styles.form}>
          {create.isError ? <ErrorNotice error={create.error} /> : null}
          <Field
            label="Condition"
            value={name}
            onChangeText={setName}
            placeholder="Type 2 Diabetes"
            hint="As your doctor described it"
            autoCapitalize="words"
          />
          <ChipGroup label="Status" options={CONDITION_STATUS} value={status} onChange={setStatus} />
          <ChipGroup
            label="Severity"
            options={CONDITION_SEVERITY}
            value={severity}
            onChange={setSeverity}
          />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button label="Cancel" onPress={() => setOpen(false)} variant="ghost" />
            </View>
            <View style={styles.grow}>
              <Button
                label="Save"
                onPress={save}
                disabled={name.trim().length === 0 || create.isPending}
                loading={create.isPending}
              />
            </View>
          </View>
        </View>
      ) : null}

      {conditions.isPending ? <Loading /> : null}
      {conditions.isError ? (
        <ErrorNotice error={conditions.error} onRetry={() => void conditions.refetch()} />
      ) : null}

      {!open && conditions.data?.items.length === 0 ? (
        <EmptyState
          title="No conditions recorded"
          body="Recording a condition lets you link the medicines, symptoms and reports that go with it."
          actionLabel="Add condition"
          onAction={() => setOpen(true)}
        />
      ) : null}

      {conditions.data?.items.map((condition) => (
        <Card key={condition.id}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <CardTitle>{condition.name}</CardTitle>
              <CardMeta>
                {[
                  condition.severity ? humanize(condition.severity) : null,
                  condition.diagnosedOn ? `since ${condition.diagnosedOn}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No details yet'}
              </CardMeta>
            </View>
            <StatusPill
              status={condition.status === 'resolved' ? 'taken' : 'pending'}
              label={humanize(condition.status)}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
});
