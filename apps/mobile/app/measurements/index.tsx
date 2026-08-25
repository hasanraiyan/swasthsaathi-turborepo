import { MEASUREMENT_DEFAULT_UNIT, MEASUREMENT_TYPE } from '@repo/contracts';
import type { Measurement, MeasurementType } from '@repo/contracts';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardMeta } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { humanize } from '../../lib/format';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../../components/ui/States';
import { useMeasurements, useRecordMeasurement } from '../../lib/queries';
import { colors, spacing, type } from '../../theme';

export default function MeasurementsScreen() {
  const measurements = useMeasurements();
  const record = useRecordMeasurement();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MeasurementType>('blood_pressure');
  const [value, setValue] = useState('');
  const [secondary, setSecondary] = useState('');

  const needsPair = kind === 'blood_pressure';
  const canSave =
    Number.isFinite(Number(value)) &&
    value.trim() !== '' &&
    (!needsPair || (secondary.trim() !== '' && Number.isFinite(Number(secondary)))) &&
    !record.isPending;

  function save() {
    record.mutate(
      {
        type: kind,
        value: Number(value),
        valueSecondary: needsPair ? Number(secondary) : null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setValue('');
          setSecondary('');
        },
      },
    );
  }

  return (
    <Screen
      onRefresh={() => void measurements.refetch()}
      refreshing={measurements.isRefetching}
      footer={open ? undefined : <Button label="Record a reading" onPress={() => setOpen(true)} />}
    >
      {open ? (
        <View style={styles.form}>
          {record.isError ? <ErrorNotice error={record.error} /> : null}
          <ChipGroup label="Reading" options={MEASUREMENT_TYPE} value={kind} onChange={setKind} />

          <View style={styles.split}>
            <View style={styles.grow}>
              <Field
                label={needsPair ? 'Systolic (upper)' : 'Value'}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                autoCapitalize="none"
                hint={MEASUREMENT_DEFAULT_UNIT[kind]}
              />
            </View>
            {needsPair ? (
              <View style={styles.grow}>
                <Field
                  label="Diastolic (lower)"
                  value={secondary}
                  onChangeText={setSecondary}
                  keyboardType="decimal-pad"
                  autoCapitalize="none"
                  hint={MEASUREMENT_DEFAULT_UNIT[kind]}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button label="Cancel" onPress={() => setOpen(false)} variant="ghost" />
            </View>
            <View style={styles.grow}>
              <Button label="Save" onPress={save} disabled={!canSave} loading={record.isPending} />
            </View>
          </View>
        </View>
      ) : null}

      {measurements.isPending ? <Loading /> : null}
      {measurements.isError ? (
        <ErrorNotice error={measurements.error} onRetry={() => void measurements.refetch()} />
      ) : null}

      {!open && measurements.data?.items.length === 0 ? (
        <EmptyState
          title="No readings yet"
          body="Blood pressure, blood sugar, weight — record them here and the trend builds itself."
          actionLabel="Record a reading"
          onAction={() => setOpen(true)}
        />
      ) : null}

      {measurements.data?.items.map((measurement) => (
        <Card key={measurement.id}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Text style={styles.label}>{humanize(measurement.type)}</Text>
              <CardMeta>{formatWhen(measurement.measuredAt)}</CardMeta>
            </View>
            <Text style={styles.reading}>{formatReading(measurement)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function formatReading(measurement: Measurement): string {
  const value =
    measurement.valueSecondary !== null
      ? `${measurement.value}/${measurement.valueSecondary}`
      : `${measurement.value}`;
  return `${value} ${measurement.unit}`;
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
  split: { flexDirection: 'row', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  label: { ...type.body, fontWeight: '600', color: colors.ink },
  reading: { ...type.title, color: colors.pine },
});
