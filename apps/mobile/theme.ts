/**
 * SwasthSaathi visual identity.
 *
 * Warm and human rather than clinical: a companion, not a hospital intake
 * form. Pine green for grounded trust, marigold for warmth -- the color of
 * turmeric, a everyday marker of health and care in Indian households.
 */
export const colors = {
  cream: '#FAF6EE',
  surface: '#FFFFFF',
  pine: '#1F4B3F',
  pineDark: '#163A30',
  // Fill only (avatar, icon backgrounds) -- too light for text on cream (2:1).
  marigold: '#E8A33D',
  // Text/link use -- same hue, darkened to clear 4.5:1 on cream.
  marigoldText: '#895810',
  ink: '#2B2620',
  // Secondary text -- darkened from the original #8C7F6E (3.6:1) to 5:1+.
  taupe: '#72685A',
  // Input borders -- a UI boundary, so held to the 3:1 non-text minimum
  // rather than the 4.5:1 text minimum.
  border: '#8F8270',
  brick: '#B23A2E',
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  input: 14,
  button: 28,
  avatar: 999,
} as const;

// Theme for Clerk's official prebuilt UI components (@clerk/expo/web), so
// they match the native custom-flow screens instead of Clerk's default
// purple. See https://clerk.com/docs/customization/overview
export const clerkAppearance = {
  variables: {
    colorPrimary: colors.pine,
    colorBackground: colors.cream,
    colorText: colors.ink,
    colorTextSecondary: colors.taupe,
    colorDanger: colors.brick,
    colorInputBackground: colors.surface,
    colorInputText: colors.ink,
    borderRadius: `${radii.input}px`,
  },
} as const;
