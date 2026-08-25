import { useAuth, useUser } from '@clerk/expo';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, spacing } from '../theme';

export function UserProfile() {
  const { signOut } = useAuth();
  const { user } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = (user?.firstName ?? email).charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.title}>
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
        </Text>
        <Text style={styles.email}>{email}</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => signOut()}
        >
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonTextPressed]}>
              Sign out
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.avatar,
    backgroundColor: colors.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.pineDark,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 14,
    color: colors.taupe,
    marginBottom: spacing.xl,
  },
  button: {
    borderWidth: 1.5,
    borderColor: colors.pine,
    borderRadius: radii.button,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
  },
  buttonPressed: {
    backgroundColor: colors.pine,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.pine,
  },
  buttonTextPressed: {
    color: colors.cream,
  },
});
