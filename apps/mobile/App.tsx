import { ClerkProvider, ClerkLoaded, ClerkLoading, Show } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthForm } from './components/AuthForm';
import { UserProfile } from './components/UserProfile';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local');
}

export default function App() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <View style={styles.container}>
        <ClerkLoading>
          <ActivityIndicator />
        </ClerkLoading>
        <ClerkLoaded>
          <Show when="signed-out">
            <AuthForm />
          </Show>
          <Show when="signed-in">
            <UserProfile />
          </Show>
        </ClerkLoaded>
        <StatusBar style="auto" />
      </View>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
