import { useAuth } from '@clerk/expo';
import { UserProfile } from '@clerk/expo/web';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '../components/ui/Screen';
import { spacing } from '../theme';

/**
 * Clerk's web account-management surface using <UserProfile />.
 */
export default function ManageAccountScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <Screen title="Account & Security">
      <View style={styles.center}>
        <UserProfile />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
