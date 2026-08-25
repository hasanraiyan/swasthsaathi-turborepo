import type { Medicine } from '@repo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardMeta, CardTitle } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { Screen } from '../../components/ui/Screen';
import { EmptyState, ErrorNotice, Loading } from '../../components/ui/States';
import { StatusPill } from '../../components/ui/StatusPill';
import { useMedicines } from '../../lib/queries';
import { spacing } from '../../theme';

const FILTERS = ['active', 'paused', 'stopped'] as const;
type Filter = (typeof FILTERS)[number];

export default function MedicinesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('active');
  const medicines = useMedicines(filter);

  return (
    <Screen
      title="Medicines"
      subtitle="What you take, and what it's for"
      menu
      onRefresh={() => void medicines.refetch()}
      refreshing={medicines.isRefetching}
      footer={<Button label="Add medicine" onPress={() => router.push('/medicines/new')} />}
    >
      <ChipGroup label="Show" options={FILTERS} value={filter} onChange={setFilter} />

      {medicines.isPending ? <Loading /> : null}
      {medicines.isError ? (
        <ErrorNotice error={medicines.error} onRetry={() => void medicines.refetch()} />
      ) : null}

      {medicines.data?.items.length === 0 ? (
        <EmptyState
          title={filter === 'active' ? 'No medicines yet' : `Nothing ${filter}`}
          body={
            filter === 'active'
              ? 'Add what you take so Swasthya Saathi can remind you and keep the record.'
              : 'Medicines you pause or stop will appear here, with their history intact.'
          }
        />
      ) : null}

      <View style={styles.list}>
        {medicines.data?.items.map((medicine) => (
          <MedicineCard
            key={medicine.id}
            medicine={medicine}
            onPress={() => router.push(`/medicines/${medicine.id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}

function MedicineCard({ medicine, onPress }: { medicine: Medicine; onPress: () => void }) {
  const detail = [medicine.strength, medicine.purpose].filter(Boolean).join(' · ');

  return (
    <Card onPress={onPress} accessibilityLabel={`${medicine.name}, ${medicine.status}`}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <CardTitle>{medicine.name}</CardTitle>
          {detail ? <CardMeta>{detail}</CardMeta> : null}
        </View>
        <StatusPill
          status={medicine.status === 'active' ? 'taken' : 'skipped'}
          label={capitalise(medicine.status)}
        />
      </View>
    </Card>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  list: { marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
});
