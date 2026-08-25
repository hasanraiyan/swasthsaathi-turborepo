import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Screen } from '../../components/ui/Screen';
import {
  useAppointments,
  useConditions,
  useDoctors,
  useMeasurements,
  useSymptoms,
} from '../../lib/queries';
import { colors, spacing, type } from '../../theme';

/**
 * The rest of the health record.
 *
 * A hub rather than five more tabs: these are things a user visits when
 * something happens, not every day, and each row carries its own count so the
 * screen says what's in there before you open it.
 */
export default function RecordsScreen() {
  const router = useRouter();
  const conditions = useConditions();
  const doctors = useDoctors();
  const appointments = useAppointments(true);
  const symptoms = useSymptoms();
  const measurements = useMeasurements();

  function refreshAll() {
    void conditions.refetch();
    void doctors.refetch();
    void appointments.refetch();
    void symptoms.refetch();
    void measurements.refetch();
  }

  return (
    <Screen
      title="Records"
      subtitle="Everything else in your health journey"
      onRefresh={refreshAll}
      refreshing={conditions.isRefetching}
    >
      <Row
        icon="activity"
        title="Conditions"
        summary={countLabel(conditions.data?.total, 'condition', 'on record')}
        onPress={() => router.push('/conditions')}
      />
      <Row
        icon="calendar"
        title="Appointments"
        summary={countLabel(appointments.data?.total, 'appointment', 'coming up')}
        onPress={() => router.push('/appointments')}
      />
      <Row
        icon="users"
        title="Doctors"
        summary={countLabel(doctors.data?.total, 'doctor', 'saved')}
        onPress={() => router.push('/doctors')}
      />
      <Row
        icon="alert-circle"
        title="Symptoms"
        summary={countLabel(symptoms.data?.total, 'entry', 'logged')}
        onPress={() => router.push('/symptoms')}
      />
      <Row
        icon="trending-up"
        title="Readings"
        summary={countLabel(measurements.data?.total, 'reading', 'recorded')}
        onPress={() => router.push('/measurements')}
      />
    </Screen>
  );
}

function countLabel(total: number | undefined, noun: string, suffix: string): string {
  if (total === undefined) {
    return '…';
  }
  if (total === 0) {
    return `No ${noun}s yet`;
  }
  return `${total} ${total === 1 ? noun : `${noun}s`} ${suffix}`;
}

function Row({
  icon,
  title,
  summary,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  summary: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${summary}`}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Feather name={icon} size={20} color={colors.pine} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.taupe} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  grow: { flex: 1 },
  title: { ...type.body, fontWeight: '600', color: colors.ink },
  summary: { ...type.caption, color: colors.taupe, marginTop: 2 },
});
