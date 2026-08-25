import { useSignIn, useSignUp } from '@clerk/expo';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

  if (pendingVerification) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>Enter the code we sent to {emailAddress}</Text>
        <TextInput
          style={styles.input}
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoFocus
        />
        {signUpErrors.fields.code ? (
          <Text style={styles.error}>{signUpErrors.fields.code.message}</Text>
        ) : null}
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Pressable style={styles.button} onPress={handleVerify} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>
        {/* Required mount point for Clerk's bot-protection challenge on sign-up. */}
        <View nativeID="clerk-captcha" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in or create an account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={emailAddress}
        onChangeText={setEmailAddress}
        autoCapitalize="none"
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
      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </Pressable>
      {/* Required mount point for Clerk's bot-protection challenge on sign-up. */}
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#d33',
    fontSize: 13,
    marginBottom: 8,
  },
});
