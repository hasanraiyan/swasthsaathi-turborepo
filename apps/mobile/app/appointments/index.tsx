import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardMeta, CardTitle } from '../../components/ui/Card';
import { ChipGroup, humanize } from '../../components/ui/ChipGroup';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../../components/ui/States';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAppointments, useCreateAppointment, useDoctors } from '../../lib/queries';
import { spacing } from '../../theme';

const VIEWS = ['upcoming', 'all'] as const;
type View_ = (typeof VIEWS)[number];

export default function AppointmentsScreen() {
  const [view, setView] = useState<View_>('upcoming');
  const appointments = useAppointments(view === 'upcoming');
  const doctors = useDoctors();
  const create = useCreateAppointment();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const timeIsValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const canSave = title.trim().length > 0 && dateIsValid && timeIsValid && !create.isPending;

  function save() {
    // Built from local parts so the offset matches where the user actually is.
    const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
    create.mutate(
      {
        title: title.trim(),
        scheduledFor,
        location: location.trim() || null,
        doctorId,
        status: 'scheduled',
      },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle('');
          setDate('');
          setTime('');
          setLocation('');
        },
      },
    );
  }

  return (
    <Screen
      onRefresh={() => void appointments.refetch()}
      refreshing={appointments.isRefetching}
      footer={open ? undefined : <Button label="Add appointment" onPress={() => setOpen(true)} />}
    >
      {open ? (
        <View style={styles.form}>
          {create.isError ? <ErrorNotice error={create.error} /> : null}
          <Field
            label="What for"
            value={title}
            onChangeText={setTitle}
            placeholder="Cardiology follow-up"
          />
          <View style={styles.split}>
            <View style={styles.grow}>
              <Field
                label="Date"
                value={date}
                onChangeText={setDate}
                placeholder="2026-09-14"
                hint="YYYY-MM-DD"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.grow}>
              <Field
                label="Time"
                value={time}
                onChangeText={setTime}
                placeholder="10:30"
                hint="24-hour"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <Field label="Where" value={location} onChangeText={setLocation} />

          {doctors.data && doctors.data.items.length > 0 ? (
            <ChipGroup
              label="Doctor"
              options={['none', ...doctors.data.items.map((doctor) => doctor.id)]}
              value={doctorId ?? 'none'}
              onChange={(value) => setDoctorId(value === 'none' ? null : value)}
              renderLabel={(value) =>
                value === 'none'
                  ? 'None'
                  : (doctors.data?.items.find((doctor) => doctor.id === value)?.name ?? value)
              }
            />
          ) : null}

          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button label="Cancel" onPress={() => setOpen(false)} variant="ghost" />
            </View>
            <View style={styles.grow}>
              <Button label="Save" onPress={save} disabled={!canSave} loading={create.isPending} />
            </View>
          </View>
        </View>
      ) : (
        <ChipGroup label="Show" options={VIEWS} value={view} onChange={setView} />
      )}

      {appointments.isPending ? <Loading /> : null}
      {appointments.isError ? (
        <ErrorNotice error={appointments.error} onRetry={() => void appointments.refetch()} />
      ) : null}

      {!open && appointments.data?.items.length === 0 ? (
        <EmptyState
          title={view === 'upcoming' ? 'Nothing coming up' : 'No appointments yet'}
          body="Add a visit and you'll have somewhere to write down what the doctor said afterwards."
          actionLabel="Add appointment"
          onAction={() => setOpen(true)}
        />
      ) : null}

      {appointments.data?.items.map((appointment) => (
        <Card key={appointment.id}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <CardTitle>{appointment.title}</CardTitle>
              <CardMeta>{formatWhen(appointment.scheduledFor)}</CardMeta>
              {appointment.location ? <CardMeta>{appointment.location}</CardMeta> : null}
              {appointment.outcome ? <CardMeta>{appointment.outcome}</CardMeta> : null}
            </View>
            <StatusPill
              status={appointmentTone(appointment.status)}
              label={humanize(appointment.status)}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function appointmentTone(status: string): 'taken' | 'pending' | 'missed' | 'skipped' {
  if (status === 'completed') {
    return 'taken';
  }
  if (status === 'missed') {
    return 'missed';
  }
  return status === 'cancelled' ? 'skipped' : 'pending';
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
});
