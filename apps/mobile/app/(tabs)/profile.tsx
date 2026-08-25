import { useAuth, useUser } from '@clerk/expo';
import { BLOOD_GROUP } from '@repo/contracts';
import type { BloodGroup, Profile } from '@repo/contracts';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { SectionHeader } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { ErrorNotice, Loading } from '../../components/ui/States';
import { useAdherence } from '../../lib/adherence';
import { useProfile, useUpdateProfile } from '../../lib/queries';
import { colors, spacing, type } from '../../theme';

/**
 * The user's own details, plus how they've been doing.
 *
 * The adherence summary lives here rather than on Today: it's a reflective
 * number, and putting it in front of someone every morning would turn a
 * companion into a scoreboard.
 */
export default function ProfileScreen() {
  const { user } = useUser();
  const profile = useProfile();
  const adherence = useAdherence();

  return (
    <Screen
      title="Profile"
      subtitle={user?.primaryEmailAddress?.emailAddress ?? undefined}
      onRefresh={() => void profile.refetch()}
      refreshing={profile.isRefetching}
    >
      {adherence.data ? <AdherenceCard summary={adherence.data} /> : null}

      {profile.isPending ? <Loading /> : null}
      {profile.isError ? (
        <ErrorNotice error={profile.error} onRetry={() => void profile.refetch()} />
      ) : null}

      {/* Keyed on `updatedAt` so a fresh save from elsewhere reseeds the form,
          rather than seeding it from an effect and cascading renders. */}
      {profile.data ? (
        <ProfileForm key={profile.data.updatedAt} profile={profile.data} />
      ) : null}
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState(profile.fullName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | 'unknown'>(
    profile.bloodGroup ?? 'unknown',
  );
  const [allergies, setAllergies] = useState(profile.allergies.join(', '));
  const [emergencyName, setEmergencyName] = useState(profile.emergencyContactName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergencyContactPhone ?? '');

  const dobIsValid = dateOfBirth === '' || /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);

  function save() {
    update.mutate({
      fullName: fullName.trim() || null,
      dateOfBirth: dateOfBirth.trim() || null,
      bloodGroup: bloodGroup === 'unknown' ? null : bloodGroup,
      allergies: allergies
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      emergencyContactName: emergencyName.trim() || null,
      emergencyContactPhone: emergencyPhone.trim() || null,
    });
  }

  return (
    <>
      {update.isError ? <ErrorNotice error={update.error} /> : null}

      <SectionHeader>About you</SectionHeader>
      <Field label="Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Field
        label="Date of birth"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="1985-04-22"
        hint="YYYY-MM-DD"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      {!dobIsValid ? <Text style={styles.invalid}>Use the format YYYY-MM-DD.</Text> : null}

      <ChipGroup
        label="Blood group"
        options={['unknown', ...BLOOD_GROUP] as const}
        value={bloodGroup}
        onChange={setBloodGroup}
        renderLabel={(option) => (option === 'unknown' ? 'Not sure' : option)}
      />

      <Field
        label="Allergies"
        value={allergies}
        onChangeText={setAllergies}
        placeholder="penicillin, peanuts"
        hint="Separated by commas"
        autoCapitalize="none"
      />

      <SectionHeader>Emergency contact</SectionHeader>
      <Field
        label="Name"
        value={emergencyName}
        onChangeText={setEmergencyName}
        autoCapitalize="words"
      />
      <Field
        label="Phone"
        value={emergencyPhone}
        onChangeText={setEmergencyPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
      />

      <View style={styles.save}>
        <Button
          label={update.isSuccess ? 'Saved' : 'Save profile'}
          onPress={save}
          disabled={!dobIsValid || update.isPending}
          loading={update.isPending}
        />
      </View>

      <View style={styles.signOut}>
        <Button label="Sign out" onPress={() => void signOut()} variant="ghost" tone="danger" />
      </View>
    </>
  );
}

function AdherenceCard({
  summary,
}: {
  summary: { adherenceRate: number | null; missed: number };
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>
        {summary.adherenceRate === null ? '—' : `${Math.round(summary.adherenceRate * 100)}%`}
      </Text>
      <Text style={styles.summaryLabel}>
        of doses taken over the last 30 days
        {summary.missed > 0 ? ` · ${summary.missed} missed` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.pine,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryValue: { ...type.display, color: colors.cream },
  summaryLabel: { ...type.caption, color: colors.cream, opacity: 0.85, marginTop: spacing.xs },
  invalid: { ...type.caption, color: colors.brick, marginTop: -spacing.sm, marginBottom: spacing.md },
  save: { marginTop: spacing.md },
  signOut: { marginTop: spacing.lg },
});
