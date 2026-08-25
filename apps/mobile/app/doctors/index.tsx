import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardMeta, CardTitle } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../../components/ui/States';
import { useCreateDoctor, useDoctors } from '../../lib/queries';
import { spacing } from '../../theme';

export default function DoctorsScreen() {
  const doctors = useDoctors();
  const create = useCreateDoctor();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hospital, setHospital] = useState('');
  const [phone, setPhone] = useState('');

  function save() {
    create.mutate(
      {
        name: name.trim(),
        specialty: specialty.trim() || null,
        hospital: hospital.trim() || null,
        phone: phone.trim() || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName('');
          setSpecialty('');
          setHospital('');
          setPhone('');
        },
      },
    );
  }

  return (
    <Screen
      onRefresh={() => void doctors.refetch()}
      refreshing={doctors.isRefetching}
      footer={open ? undefined : <Button label="Add doctor" onPress={() => setOpen(true)} />}
    >
      {open ? (
        <View style={styles.form}>
          {create.isError ? <ErrorNotice error={create.error} /> : null}
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Dr. Meera Nair"
            autoCapitalize="words"
          />
          <Field
            label="Specialty"
            value={specialty}
            onChangeText={setSpecialty}
            placeholder="Cardiologist"
            autoCapitalize="words"
          />
          <Field
            label="Clinic or hospital"
            value={hospital}
            onChangeText={setHospital}
            autoCapitalize="words"
          />
          <Field
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
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

      {doctors.isPending ? <Loading /> : null}
      {doctors.isError ? (
        <ErrorNotice error={doctors.error} onRetry={() => void doctors.refetch()} />
      ) : null}

      {!open && doctors.data?.items.length === 0 ? (
        <EmptyState
          title="No doctors saved"
          body="Save the doctors you see so appointments and prescriptions can point at them."
          actionLabel="Add doctor"
          onAction={() => setOpen(true)}
        />
      ) : null}

      {doctors.data?.items.map((doctor) => (
        <Card key={doctor.id}>
          <CardTitle>{doctor.name}</CardTitle>
          <CardMeta>
            {[doctor.specialty, doctor.hospital].filter(Boolean).join(' · ') || 'No details yet'}
          </CardMeta>
          {doctor.phone ? <CardMeta>{doctor.phone}</CardMeta> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
});
