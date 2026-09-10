import Constants from 'expo-constants';

/**
 * The Clerk publishable key, resolved once for the whole app.
 *
 * 1. EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY - local override, from .env.local
 * 2. app.json expo.extra.clerkPublishableKey - fallback
 */
export const clerkPublishableKey: string =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ||
  '';

if (!clerkPublishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to apps/mobile/.env.local');
}
