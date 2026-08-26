import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * SwasthSaathi visual identity.
 *
 * Warm and human rather than clinical: a companion, not a hospital intake
 * form. Pine green for grounded trust, marigold for warmth -- the color of
 * turmeric, an everyday marker of health and care in Indian households.
 * `brick` carries the same idea one step further: the red of sindoor and
 * kumkum, marks worn for protection and wellbeing rather than a stock
 * "error" red -- it means "this needs you," not "something broke."
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
  // Hairline separators inside cards, where a 3:1 boundary would shout.
  hairline: '#E6DFD2',
  brick: '#B23A2E',
} as const;

/**
 * Dose and record states, as a fill plus a text-safe ink.
 *
 * Colour alone never carries the meaning -- every use pairs these with a word
 * ("Taken", "Missed"), because a schedule someone reads at 6am while unwell
 * has to survive both colour blindness and a dim screen.
 */
export const statusColors = {
  taken: { fill: '#E4EFE7', ink: '#1F4B3F' },
  pending: { fill: '#FBF0DC', ink: '#895810' },
  missed: { fill: '#F7E3E0', ink: '#8E2B21' },
  skipped: { fill: '#EDE9E1', ink: '#5C5348' },
} as const;

/**
 * Type scale. Display sizes use Baloo 2 -- a rounded, humanist face rather
 * than a literary serif, and one built with Devanagari in mind alongside
 * Latin. For a companion meant to work across languages, that pairing
 * ability is a real requirement, not a look: a heading that has to survive
 * being read in Hindi as comfortably as English shouldn't lean on a face
 * that only has an opinion about the Latin alphabet. The rest is the system
 * face, which already carries every script this app needs without a
 * per-language font to load.
 */
export const type = {
  display: { fontFamily: 'Baloo2_700Bold', fontSize: 28, lineHeight: 34 },
  title: { fontFamily: 'Baloo2_700Bold', fontSize: 20, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, letterSpacing: 0.3 },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

export const fonts = {
  display: 'Baloo2_700Bold',
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

/**
 * How wide a screen's own content is allowed to get.
 *
 * Every screen here is built for a phone-width column: a form field, a
 * card, a line of chat. Letting that column stretch to fill a desktop
 * browser window doesn't make it more useful -- it makes every line of text
 * absurdly long and every card look lost in empty space. Capping the width
 * and centering it is what makes the same layout that already works on a
 * phone also read correctly at any wider size, without a second design.
 */
export const contentMaxWidth = 720;

/**
 * Suppress the browser's own focus ring on text inputs.
 *
 * `react-native-web` renders `TextInput` as a real DOM input, so the browser
 * draws its focus outline -- a heavy black ring in current Chrome -- outside
 * our border, which looks like a bug. `outlineStyle` is a web-only style, so
 * it is cast once here rather than at every call site.
 *
 * Always pair it with `inputBorderColor` below: dropping the ring without
 * replacing it would leave anyone navigating by keyboard unable to see where
 * they are.
 */
export const webOutlineReset = (
  Platform.OS === 'web' ? { outlineStyle: 'none' } : {}
) as unknown as TextStyle;

/** The focus indicator we show instead of the browser's. */
export function inputBorderColor(focused: boolean): string {
  return focused ? colors.pine : colors.border;
}

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
