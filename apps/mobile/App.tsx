import { ClerkProvider, ClerkLoaded, ClerkLoading, Show } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { SignIn, UserButton } from '@clerk/expo/web';
// Import each weight from its own subpath, not the package barrel -- the
// barrel's index.js requires every weight's .ttf, which Metro then bundles
// in full (~2.8MB for all 18 Fraunces weights) regardless of which named
// exports are actually used.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces/600SemiBold_Italic';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthForm } from './components/AuthForm';
import { UserProfile } from './components/UserProfile';
import { Wordmark } from './components/Wordmark';
import { clerkAppearance, colors } from './theme';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local');
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
  });

  useEffect(() => {
    if (fontError) {
      console.warn('Failed to load display font, continuing with system font:', fontError);
    }
  }, [fontError]);

  // Don't block the app forever if the font fails to load -- fall back to
  // the system font instead of an infinite spinner.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.pine} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ClerkProvider
        publishableKey={publishableKey}
        tokenCache={tokenCache}
        appearance={clerkAppearance}
      >
        <View style={styles.container}>
          <ClerkLoading>
            <ActivityIndicator color={colors.pine} />
          </ClerkLoading>
          <ClerkLoaded>
            <Show when="signed-out">
              {Platform.OS === 'web' ? <WebSignIn /> : <AuthForm />}
            </Show>
            <Show when="signed-in">
              {Platform.OS === 'web' ? <WebUserProfile /> : <UserProfile />}
            </Show>
          </ClerkLoaded>
          <StatusBar style="dark" />
        </View>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

// Clerk's official prebuilt web components -- the same <SignIn /> you'd get
// on a React/Next.js site. Only mounts on web: it renders DOM and throws on
// native. Native keeps the custom useSignIn()/useSignUp() flow because the
// native equivalent (AuthView) requires a development build this project
// doesn't have set up yet.
function WebSignIn() {
  return (
    <SafeAreaView style={styles.webContainer}>
      <Wordmark tagline="your health companion" />
      <View style={styles.webWidget}>
        <SignIn />
      </View>
    </SafeAreaView>
  );
}

function WebUserProfile() {
  return (
    <SafeAreaView style={styles.webContainer}>
      <UserButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  webContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    paddingVertical: 32,
  },
  webWidget: {
    marginTop: 16,
  },
});
