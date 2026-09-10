import { useAuth } from '@clerk/expo';
import { UserProfileView } from '@clerk/expo/native';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';

/**
 * Clerk's native account-management surface: avatar, email addresses,
 * passkeys, connected accounts, security and account deletion.
 *
 * Uses Clerk's native UserProfileView, styled by clerk-theme.json.
 */
export default function ManageAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <UserProfileView
        style={styles.profile}
        isDismissible={false}
        onHostBack={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  profile: {
    flex: 1,
  },
});
