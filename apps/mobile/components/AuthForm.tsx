import { useSignIn, useSignUp } from '@clerk/expo';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from './Wordmark';
import { colors, fonts, radii, spacing } from '../theme';

export function AuthForm() {
  const { signIn, errors: signInErrors, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpFetchStatus } = useSignUp();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submitting = signInFetchStatus === 'fetching' || signUpFetchStatus === 'fetching';

  const handleSubmit = async () => {
    setFormError(null);

    const { error } = await signIn.password({ emailAddress, password });
    if (!error) {
      if (signIn.status === 'complete') {
        await signIn.finalize();
      }
      return;
    }

    if (error.code !== 'form_identifier_not_found') {
      setFormError(error.message);
      return;
    }

    // No existing user with this email -- fall back to creating one.
    const { error: signUpError } = await signUp.password({ emailAddress, password });
    if (signUpError) {
      setFormError(signUpError.message);
      return;
    }

    const { error: sendCodeError } = await signUp.verifications.sendEmailCode();
    if (sendCodeError) {
      setFormError(sendCodeError.message);
      return;
    }
    setPendingVerification(true);
  };

  const handleVerify = async () => {
    setFormError(null);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setFormError(error.message);
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize();
    }
  };

  const handleResend = async () => {
    setFormError(null);
    await signUp.verifications.sendEmailCode();
  };

  const handleUseDifferentEmail = async () => {
    setFormError(null);
    setCode('');
    setPendingVerification(false);
    await signUp.reset();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Wordmark tagline="your health companion" />

          {pendingVerification ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.subheading}>
                Enter the code we sent to {emailAddress}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Verification code"
                placeholderTextColor={colors.taupe}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoFocus
              />
              {signUpErrors.fields.code ? (
                <Text style={styles.error}>{signUpErrors.fields.code.message}</Text>
              ) : null}
              {formError ? <Text style={styles.error}>{formError}</Text> : null}

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleVerify}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </Pressable>

              <View style={styles.linkRow}>
                <Pressable onPress={handleResend} disabled={submitting}>
                  <Text style={styles.linkAccent}>Resend code</Text>
                </Pressable>
                <Pressable onPress={handleUseDifferentEmail} disabled={submitting}>
                  <Text style={styles.linkMuted}>Use a different email</Text>
                </Pressable>
              </View>

              {/* Required mount point for Clerk's bot-protection challenge on sign-up. */}
              <View nativeID="clerk-captcha" />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.heading}>Sign in or create an account</Text>

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.taupe}
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              {signInErrors.fields.identifier ? (
                <Text style={styles.error}>{signInErrors.fields.identifier.message}</Text>
              ) : null}
              {signUpErrors.fields.emailAddress ? (
                <Text style={styles.error}>{signUpErrors.fields.emailAddress.message}</Text>
              ) : null}

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.taupe}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
              />
              {signInErrors.fields.password ? (
                <Text style={styles.error}>{signInErrors.fields.password.message}</Text>
              ) : null}
              {signUpErrors.fields.password ? (
                <Text style={styles.error}>{signUpErrors.fields.password.message}</Text>
              ) : null}
              {formError ? <Text style={styles.error}>{formError}</Text> : null}

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </Pressable>

              <Text style={styles.disclaimer}>
                New here? Continuing creates your account automatically.
              </Text>

              {/* Required mount point for Clerk's bot-protection challenge on sign-up. */}
              <View nativeID="clerk-captcha" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    marginTop: spacing.xl,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subheading: {
    fontSize: 14,
    color: colors.taupe,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.pine,
    borderRadius: radii.button,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonPressed: {
    backgroundColor: colors.pineDark,
  },
  buttonText: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: colors.taupe,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  error: {
    color: colors.brick,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  linkAccent: {
    color: colors.marigoldText,
    fontSize: 14,
    fontWeight: '600',
  },
  linkMuted: {
    color: colors.taupe,
    fontSize: 14,
  },
});
