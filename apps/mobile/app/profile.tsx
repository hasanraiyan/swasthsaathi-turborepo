import { useAuth, useUser } from '@clerk/expo';
import Feather from '@expo/vector-icons/Feather';
import { BLOOD_GROUP } from '@repo/contracts';
import type { BloodGroup, Profile } from '@repo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card, SectionHeader } from '../components/ui/Card';
import { ChipGroup } from '../components/ui/ChipGroup';
import { DateOfBirthField } from '../components/ui/DateOfBirthField';
import { Field } from '../components/ui/Field';
import { Screen } from '../components/ui/Screen';
import { ErrorNotice, Loading } from '../components/ui/States';
import { useAdherence } from '../lib/adherence';
import { useHealthSnapshot, useProfile, useUpdateProfile } from '../lib/queries';
import { colors, radii, spacing, type } from '../theme';

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
      menu
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

      <BaselineLink />

      <SectionHeader>About you</SectionHeader>
      <Field label="Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} />

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
          disabled={update.isPending}
          loading={update.isPending}
        />
      </View>

      <View style={styles.signOut}>
        <Button label="Sign out" onPress={() => void signOut()} variant="ghost" tone="danger" />
      </View>
    </>
  );
}

/** The baseline lives on its own screen; this is the way in from Profile. */
function BaselineLink() {
  const router = useRouter();
  const snapshot = useHealthSnapshot();
  const complete = snapshot.data?.baselineComplete ?? false;

  return (
    <Card onPress={() => router.push('/baseline')} accessibilityLabel="Health baseline">
      <View style={styles.linkRow}>
        <Feather name="user-check" size={18} color={complete ? colors.pine : colors.marigoldText} />
        <View style={styles.linkText}>
          <Text style={styles.linkTitle}>Health baseline</Text>
          <Text style={styles.linkBody}>
            {complete
              ? 'Age, body, habits and family history — used to build your checks.'
              : 'Not finished yet. Your checks stay generic until it is.'}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.taupe} />
      </View>
    </Card>
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
    borderRadius: radii.input,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryValue: { ...type.display, color: colors.cream },
  summaryLabel: { ...type.caption, color: colors.cream, opacity: 0.85, marginTop: spacing.xs },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkText: { flex: 1 },
  linkTitle: { ...type.body, fontWeight: '600', color: colors.ink },
  linkBody: { ...type.caption, color: colors.taupe, marginTop: 2 },
  invalid: { ...type.caption, color: colors.brick, marginTop: -spacing.sm, marginBottom: spacing.md },
  save: { marginTop: spacing.md },
  signOut: { marginTop: spacing.lg },
});
