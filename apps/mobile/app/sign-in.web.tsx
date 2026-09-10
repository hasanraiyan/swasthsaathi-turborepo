import { useAuth } from '@clerk/expo';
import { SignIn } from '@clerk/expo/web';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '../components/Wordmark';
import { colors, spacing } from '../theme';

/**
 * Sign in or create an account on Web.
 *
 * Uses Clerk's official prebuilt web <SignIn /> component, styled
 * via clerkAppearance in theme.ts.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <SafeAreaView style={styles.web}>
      <Wordmark tagline="your health companion" />
      <View style={styles.widget}>
        <SignIn />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  web: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    paddingVertical: spacing.xl,
  },
  widget: { marginTop: spacing.md },
});
