import { MEDICINE_FORM } from '@repo/contracts';
import type { MedicineForm } from '@repo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { Field } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { ErrorNotice } from '../../components/ui/States';
import { useConditions, useCreateMedicine } from '../../lib/queries';
import { colors, spacing, type } from '../../theme';

/**
 * Add a medicine.
 *
 * Only the name is required. Everything else -- strength, purpose, what it
 * treats -- can be filled in later, because the moment someone is willing to
 * record a medicine is usually the moment they have the strip in hand and no
 * patience for a form.
 */
export default function NewMedicineScreen() {
  const router = useRouter();
  const create = useCreateMedicine();
  const conditions = useConditions();

  const [name, setName] = useState('');
  const [form, setForm] = useState<MedicineForm>('tablet');
  const [strength, setStrength] = useState('');
  const [purpose, setPurpose] = useState('');
  const [conditionId, setConditionId] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && !create.isPending;

  function save() {
    create.mutate(
      {
        name: name.trim(),
        form,
        strength: strength.trim() || null,
        purpose: purpose.trim() || null,
        conditionId,
        status: 'active',
      },
      { onSuccess: (medicine) => router.replace(`/medicines/${medicine.id}`) },
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label="Save medicine"
            onPress={save}
            disabled={!canSave}
            loading={create.isPending}
          />
        }
      >
        {create.isError ? <ErrorNotice error={create.error} /> : null}

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Metformin"
          hint="As written on the strip or prescription"
          autoCapitalize="words"
        />

        <ChipGroup label="Form" options={MEDICINE_FORM} value={form} onChange={setForm} />

        <Field
          label="Strength"
          value={strength}
          onChangeText={setStrength}
          placeholder="500 mg"
          hint="Per unit, e.g. 500 mg or 5 ml"
          autoCapitalize="none"
        />

        <Field
          label="What it's for"
          value={purpose}
          onChangeText={setPurpose}
          placeholder="for blood sugar"
          hint="In your own words"
        />

        {conditions.data && conditions.data.items.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.label}>Linked condition</Text>
            <View style={styles.chips}>
              <Choice
                label="None"
                selected={conditionId === null}
                onPress={() => setConditionId(null)}
              />
              {conditions.data.items.map((condition) => (
                <Choice
                  key={condition.id}
                  label={condition.name}
                  selected={conditionId === condition.id}
                  onPress={() => setConditionId(condition.id)}
                />
              ))}
            </View>
            <Text style={styles.hint}>
              Linking lets Swasthya Saathi answer &quot;what am I taking this for?&quot;
            </Text>
          </View>
        ) : null}

        <Text style={styles.footnote}>
          Next you&apos;ll set when to take it, so it appears on Today.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button label={label} onPress={onPress} variant={selected ? 'primary' : 'outline'} />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginBottom: spacing.md },
  label: { ...type.label, color: colors.ink, marginBottom: spacing.xs },
  chips: { gap: spacing.sm },
  hint: { ...type.caption, color: colors.taupe, marginTop: spacing.xs },
  footnote: { ...type.caption, color: colors.taupe, marginTop: spacing.md },
});
