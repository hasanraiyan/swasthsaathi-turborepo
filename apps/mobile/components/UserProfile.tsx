import { useAuth, useUser } from '@clerk/expo';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function UserProfile() {
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome{user?.firstName ? `, ${user.firstName}` : ''}</Text>
      <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
      <Pressable style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  button: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
