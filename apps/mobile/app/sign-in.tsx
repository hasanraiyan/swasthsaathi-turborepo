import { SignIn } from '@clerk/expo/web';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthForm } from '../components/AuthForm';
import { Wordmark } from '../components/Wordmark';
import { colors, spacing } from '../theme';

/**
 * Sign in or create an account.
 *
 * Web gets Clerk's own prebuilt `<SignIn />` -- the same component a React or
 * Next.js site would use. Native keeps the custom `useSignIn()`/`useSignUp()`
 * flow, because Clerk's native `AuthView` renders DOM and throws off the web.
 */
export default function SignInScreen() {
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.web}>
        <Wordmark tagline="your health companion" />
        <View style={styles.widget}>
          <SignIn />
        </View>
      </SafeAreaView>
    );
  }
  return <AuthForm />;
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
