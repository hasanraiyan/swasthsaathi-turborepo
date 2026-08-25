import {
  ACTIVITY_LEVEL,
  ALCOHOL_USE,
  FAMILY_HISTORY,
  SEX_AT_BIRTH,
  TOBACCO_USE,
} from '@repo/contracts';
import type {
  ActivityLevel,
  AlcoholUse,
  FamilyHistoryItem,
  Profile,
  SexAtBirth,
  TobaccoUse,
} from '@repo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/Card';
import { ChipGroup, MultiChipGroup } from '../components/ui/ChipGroup';
import { DateOfBirthField } from '../components/ui/DateOfBirthField';
import { Field } from '../components/ui/Field';
import { Screen } from '../components/ui/Screen';
import { ErrorNotice, Loading } from '../components/ui/States';
import { useProfile, useUpdateProfile } from '../lib/queries';
import { colors, spacing, type } from '../theme';

/**
 * The health baseline.
 *
 * These few facts are what make everything else preventive: which screenings
 * apply, how often, and what to warn about. Without them the product can only
 * react to what a person already has.
 *
 * Every answer is a tap except height, weight and the date of birth digits --
 * no formats to remember, no free text to get wrong.
 */
export default function BaselineScreen() {
  const profile = useProfile();

  if (profile.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorNotice error={profile.error} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  return <BaselineForm key={profile.data.updatedAt} profile={profile.data} />;
}

function BaselineForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const update = useUpdateProfile();

  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [sexAtBirth, setSexAtBirth] = useState<SexAtBirth | 'unset'>(
    profile.sexAtBirth ?? 'unset',
  );
  const [heightCm, setHeightCm] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [weightKg, setWeightKg] = useState(profile.weightKg ? String(profile.weightKg) : '');
  const [tobaccoUse, setTobaccoUse] = useState<TobaccoUse | 'unset'>(profile.tobaccoUse ?? 'unset');
  const [alcoholUse, setAlcoholUse] = useState<AlcoholUse | 'unset'>(profile.alcoholUse ?? 'unset');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | 'unset'>(
    profile.activityLevel ?? 'unset',
  );
  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryItem[]>(profile.familyHistory);

  const height = Number(heightCm);
  const weight = Number(weightKg);
  const complete =
    dateOfBirth !== '' &&
    sexAtBirth !== 'unset' &&
    height > 0 &&
    weight > 0 &&
    tobaccoUse !== 'unset' &&
    alcoholUse !== 'unset' &&
    activityLevel !== 'unset';

  function save() {
    update.mutate(
      {
        dateOfBirth: dateOfBirth || null,
        sexAtBirth: sexAtBirth === 'unset' ? null : sexAtBirth,
        heightCm: height > 0 ? height : null,
        weightKg: weight > 0 ? weight : null,
        tobaccoUse: tobaccoUse === 'unset' ? null : tobaccoUse,
        alcoholUse: alcoholUse === 'unset' ? null : alcoholUse,
        activityLevel: activityLevel === 'unset' ? null : activityLevel,
        familyHistory,
      },
      // Land on the plan the answers just produced, so the point of filling
      // this in is immediately visible.
      { onSuccess: () => router.replace('/checks') },
    );
  }

  return (
    <Screen
      title="Your health baseline"
      subtitle="A few facts decide which checks you actually need. Two minutes, and you can change it any time."
      footer={
        <Button
          label={complete ? 'Save and see my checks' : 'Save what I have'}
          onPress={save}
          loading={update.isPending}
        />
      }
    >
      {update.isError ? <ErrorNotice error={update.error} /> : null}

      <SectionHeader>About you</SectionHeader>
      <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} />

      <ChipGroup
        label="Sex at birth"
        options={['unset', ...SEX_AT_BIRTH] as const}
        value={sexAtBirth}
        onChange={setSexAtBirth}
        renderLabel={(option) =>
          option === 'unset'
            ? 'Not said'
            : option === 'prefer_not_to_say'
              ? 'Prefer not to say'
              : option === 'male'
                ? 'Male'
                : option === 'female'
                  ? 'Female'
                  : 'Other'
        }
      />
      <Text style={styles.note}>
        Some checks differ by sex — anaemia and cervical screening among them.
      </Text>

      <View style={styles.split}>
        <View style={styles.grow}>
          <Field
            label="Height"
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="number-pad"
            autoCapitalize="none"
            hint="in centimetres"
          />
        </View>
        <View style={styles.grow}>
          <Field
            label="Weight"
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            autoCapitalize="none"
            hint="in kilograms"
          />
        </View>
      </View>

      <SectionHeader>Daily habits</SectionHeader>
      <ChipGroup
        label="Tobacco"
        options={['unset', ...TOBACCO_USE] as const}
        value={tobaccoUse}
        onChange={setTobaccoUse}
        renderLabel={(option) => TOBACCO_LABELS[option] ?? option}
      />
      <Text style={styles.note}>
        Counts cigarettes, bidi, gutkha, khaini and paan masala.
      </Text>

      <ChipGroup
        label="Alcohol"
        options={['unset', ...ALCOHOL_USE] as const}
        value={alcoholUse}
        onChange={setAlcoholUse}
        renderLabel={(option) => ALCOHOL_LABELS[option] ?? option}
      />

      <ChipGroup
        label="Moving about"
        options={['unset', ...ACTIVITY_LEVEL] as const}
        value={activityLevel}
        onChange={setActivityLevel}
        renderLabel={(option) => ACTIVITY_LABELS[option] ?? option}
      />

      <SectionHeader>Family</SectionHeader>
      <MultiChipGroup
        label="Anything in a parent, brother, sister or child"
        options={FAMILY_HISTORY}
        values={familyHistory}
        onChange={setFamilyHistory}
        noneLabel="None that I know of"
        renderLabel={(option) => FAMILY_LABELS[option] ?? option}
        hint="Family history means screening earlier — not that you will get it."
      />

      {!complete ? (
        <Text style={styles.note}>
          You can save now and finish later. The more of this we have, the more your plan is
          actually about you.
        </Text>
      ) : null}
    </Screen>
  );
}

const TOBACCO_LABELS: Record<string, string> = {
  unset: 'Not said',
  never: 'Never',
  former: 'I used to',
  occasional: 'Sometimes',
  daily: 'Every day',
};

const ALCOHOL_LABELS: Record<string, string> = {
  unset: 'Not said',
  never: 'Never',
  occasional: 'Occasionally',
  regular: 'Regularly',
};

const ACTIVITY_LABELS: Record<string, string> = {
  unset: 'Not said',
  sedentary: 'Mostly sitting',
  light: 'A little walking',
  moderate: 'Fairly active',
  active: 'Very active',
};

const FAMILY_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  hypertension: 'High BP',
  heart_disease: 'Heart disease',
  stroke: 'Stroke',
  cancer: 'Cancer',
  kidney_disease: 'Kidney disease',
  thyroid: 'Thyroid',
  tuberculosis: 'TB',
  mental_health: 'Mental health',
};

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  note: { ...type.caption, color: colors.taupe, marginTop: -spacing.sm, marginBottom: spacing.md },
});
