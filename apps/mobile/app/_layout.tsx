import { ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
// Import from its own subpath, not the package barrel -- the barrel requires
// every weight's .ttf, which Metro then bundles in full regardless of what is
// used. One weight only: a rounded display face reads as friendly at both the
// sizes it's used at, so there's no need for a second.
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppDrawer } from '../components/nav/AppDrawer';
import { ChatProvider } from '../lib/chat-store';
import { DrawerProvider } from '../lib/navigation';
import { clerkAppearance, colors } from '../theme';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to apps/mobile/.env.local');
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_700Bold,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            // A phone that's been in a pocket for an hour should show fresh
            // medicine times the moment it's opened.
            refetchOnMount: true,
          },
        },
      }),
  );

  useEffect(() => {
    if (fontError) {
      console.warn('Display font failed to load, falling back to system:', fontError);
    }
  }, [fontError]);

  // Never block forever on a font: fall through to the system face instead.
  if (!fontsLoaded && !fontError) {
    return <Splash />;
  }

  return (
    <SafeAreaProvider>
      <ClerkProvider
        publishableKey={publishableKey}
        tokenCache={tokenCache}
        appearance={clerkAppearance}
      >
        <QueryClientProvider client={queryClient}>
          {/* Above the route tree, so a conversation and the drawer's state
              both survive moving between sections. */}
          <ChatProvider>
            <DrawerProvider>
              <ClerkLoading>
                <Splash />
              </ClerkLoading>
              <ClerkLoaded>
                <AuthGate />
                {/* One drawer for the whole app, over every screen. */}
                <AppDrawer />
              </ClerkLoaded>
            </DrawerProvider>
          </ChatProvider>
          <StatusBar style="dark" />
        </QueryClientProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

/**
 * Keeps the route tree and the session in step.
 *
 * Both directions matter: a signed-out user must never land inside the app,
 * and a user who has just signed in must not be left staring at the sign-in
 * screen.
 */
function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const onSignIn = segments[0] === 'sign-in';
    // Native has no equivalent screen: opening the app is already the "what
    // is this" moment there, so an unauthenticated visitor goes straight to
    // sign-in exactly as before. Only the web front door changed.
    const onWelcome = Platform.OS === 'web' && segments[0] === 'welcome';

    if (!isSignedIn && !onSignIn && !onWelcome) {
      router.replace(Platform.OS === 'web' ? '/welcome' : '/sign-in');
    } else if (isSignedIn && (onSignIn || onWelcome)) {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.pine,
        headerTitleStyle: { fontFamily: 'Baloo2_700Bold', color: colors.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      {/* Primary sections. Each renders its own top bar with the menu button,
          so the stack header is off. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="today" options={{ headerShown: false }} />
      <Stack.Screen name="checks" options={{ headerShown: false }} />
      <Stack.Screen name="medicines/index" options={{ headerShown: false }} />
      <Stack.Screen name="records" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />

      {/* The call screen is its own full-bleed UI, not a chat sub-page --
          modal presentation and no stack header, same reasoning as the
          primary sections above but for a different kind of screen. */}
      <Stack.Screen name="call" options={{ headerShown: false, presentation: 'modal' }} />

      {/* Sub-pages reached from a section. These keep the stack header, so the
          way back out is a back arrow rather than the drawer. */}
      <Stack.Screen name="baseline" options={{ title: 'Health baseline' }} />
      <Stack.Screen name="calls" options={{ title: 'Calls' }} />
      <Stack.Screen name="medicines/new" options={{ title: 'Add medicine' }} />
      <Stack.Screen name="medicines/[id]" options={{ title: 'Medicine' }} />
      <Stack.Screen name="conditions/index" options={{ title: 'Conditions' }} />
      <Stack.Screen name="doctors/index" options={{ title: 'Doctors' }} />
      <Stack.Screen name="appointments/index" options={{ title: 'Appointments' }} />
      <Stack.Screen name="symptoms/index" options={{ title: 'Symptoms' }} />
      <Stack.Screen name="measurements/index" options={{ title: 'Readings' }} />
    </Stack>
  );
}

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.pine} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
