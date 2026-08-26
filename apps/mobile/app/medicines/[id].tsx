import { DOSE_TIMING } from '@repo/contracts';
import type { DoseTiming, MedicationSchedule } from '@repo/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardMeta, CardTitle, SectionHeader } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { humanize } from '../../lib/format';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../../components/ui/States';
import { StatusPill } from '../../components/ui/StatusPill';
import { ApiError } from '../../lib/api';
import { useCreateSchedule, useMedicine, useStopMedicine } from '../../lib/queries';
import { colors, spacing, type } from '../../theme';

export default function MedicineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const medicine = useMedicine(id ?? '');
  const stop = useStopMedicine();
  const [confirmingStop, setConfirmingStop] = useState(false);

  if (medicine.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (medicine.isError || !medicine.data) {
    return (
      <Screen>
        <ErrorNotice error={medicine.error} onRetry={() => void medicine.refetch()} />
      </Screen>
    );
  }

  const item = medicine.data;
  const detail = [item.strength, humanize(item.form)].filter(Boolean).join(' · ');

  function stopMedicine() {
    stop.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          setConfirmingStop(false);
          router.back();
        },
      },
    );
  }

  return (
    <Screen
      title={item.name}
      subtitle={detail || undefined}
      onRefresh={() => void medicine.refetch()}
      refreshing={medicine.isRefetching}
    >
      <View style={styles.statusRow}>
        <StatusPill
          status={item.status === 'active' ? 'taken' : 'skipped'}
          label={humanize(item.status)}
        />
        {item.purpose ? <Text style={styles.purpose}>{item.purpose}</Text> : null}
      </View>

      {item.stoppedReason ? (
        <Text style={styles.note}>Stopped: {item.stoppedReason}</Text>
      ) : null}

      <SectionHeader>Schedule</SectionHeader>
      {item.schedules.length === 0 ? (
        <EmptyState
          title="No times set"
          body="Add a time and this medicine will appear on Today, every day it's due."
        />
      ) : (
        item.schedules.map((schedule) => <ScheduleCard key={schedule.id} schedule={schedule} />)
      )}

      <AddSchedule medicineId={item.id} />

      {item.status === 'active' ? (
        <View style={styles.stop}>
          <Button
            label="Stop taking this"
            onPress={() => setConfirmingStop(true)}
            variant="outline"
            tone="danger"
          />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmingStop}
        title="Stop this medicine?"
        body={
          stop.isError
            ? errorMessage(stop.error)
            : 'Reminders stop and future doses are removed. Your history is kept.'
        }
        confirmLabel="Stop"
        destructive
        busy={stop.isPending}
        onConfirm={stopMedicine}
        onCancel={() => setConfirmingStop(false)}
      />
    </Screen>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function ScheduleCard({ schedule }: { schedule: MedicationSchedule }) {
  const days =
    schedule.daysOfWeek.length === 0
      ? 'Every day'
      : schedule.daysOfWeek.map((day) => DAY_NAMES[day]).join(', ');

  return (
    <Card>
      <CardTitle>{schedule.timesOfDay.join(' · ')}</CardTitle>
      <CardMeta>
        {schedule.doseAmount} {schedule.doseUnit} · {humanize(schedule.timing)}
      </CardMeta>
      <CardMeta>
        {days}
        {schedule.endsOn ? ` · until ${schedule.endsOn}` : ''}
        {schedule.active ? '' : ' · inactive'}
      </CardMeta>
    </Card>
  );
}

/**
 * Adding a time is the step that turns a recorded medicine into a daily
 * routine, so it sits inline on the detail screen rather than behind another
 * navigation push.
 */
function AddSchedule({ medicineId }: { medicineId: string }) {
  const create = useCreateSchedule();
  const [open, setOpen] = useState(false);
  const [times, setTimes] = useState('');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState('tablet');
  const [timing, setTiming] = useState<DoseTiming>('anytime');

  const parsedTimes = times
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const timesAreValid =
    parsedTimes.length > 0 && parsedTimes.every((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
  const amountValue = Number(amount);
  const canSave = timesAreValid && amountValue > 0 && !create.isPending;

  if (!open) {
    return (
      <View style={styles.addToggle}>
        <Button label="Add a time" onPress={() => setOpen(true)} variant="outline" />
      </View>
    );
  }

  function save() {
    create.mutate(
      {
        medicineId,
        timesOfDay: parsedTimes,
        doseAmount: amountValue,
        doseUnit: unit.trim() || 'tablet',
        timing,
        daysOfWeek: [],
        remindersEnabled: true,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setTimes('');
        },
      },
    );
  }

  return (
    <View style={styles.form}>
      {create.isError ? <ErrorNotice error={create.error} /> : null}

      <Field
        label="Times"
        value={times}
        onChangeText={setTimes}
        placeholder="08:00, 20:00"
        hint="24-hour times, separated by commas"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      {times.length > 0 && !timesAreValid ? (
        <Text style={styles.invalid}>Use 24-hour times like 08:00 or 20:30.</Text>
      ) : null}

      <View style={styles.split}>
        <View style={styles.grow}>
          <Field
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.grow}>
          <Field label="Unit" value={unit} onChangeText={setUnit} autoCapitalize="none" />
        </View>
      </View>

      <ChipGroup label="When" options={DOSE_TIMING} value={timing} onChange={setTiming} />

      <View style={styles.formActions}>
        <View style={styles.grow}>
          <Button label="Cancel" onPress={() => setOpen(false)} variant="ghost" />
        </View>
        <View style={styles.grow}>
          <Button
            label="Save time"
            onPress={save}
            disabled={!canSave}
            loading={create.isPending}
          />
        </View>
      </View>
    </View>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  purpose: { ...type.body, color: colors.taupe, flexShrink: 1 },
  note: { ...type.caption, color: colors.taupe, marginTop: spacing.sm },
  addToggle: { marginTop: spacing.sm },
  form: { marginTop: spacing.md },
  split: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  formActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  invalid: { ...type.caption, color: colors.brick, marginTop: -spacing.sm, marginBottom: spacing.sm },
  stop: { marginTop: spacing.xl },
});
