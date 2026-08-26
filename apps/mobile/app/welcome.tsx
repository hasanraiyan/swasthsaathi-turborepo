import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '../components/Wordmark';
import { ThreadRule } from '../components/ui/ThreadRule';
import { NAV_SECTIONS } from '../lib/navigation';
import { colors, radii, spacing, type } from '../theme';

const WIDE = 860;

/**
 * The web front door for anyone not signed in yet.
 *
 * Web only -- see the redirect in `_layout.tsx`. Native has no equivalent:
 * opening the app is already the "what is this" moment there, but a browser
 * tab needs one before a sign-in form makes sense.
 *
 * Every claim on this page is something the app actually does today. The
 * product has no reminders, no other language in its interface yet, and no
 * voice input -- so none of those appear here, whatever the eventual plan
 * for them is.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <Header onSignIn={() => router.push('/sign-in')} />
          <Hero onSignIn={() => router.push('/sign-in')} />
          <Features wide={wide} />
          <ClosingCta onSignIn={() => router.push('/sign-in')} />
          <Footer />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={styles.header}>
      <Wordmark />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in"
        onPress={onSignIn}
        style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}
      >
        <Text style={styles.headerLinkText}>Sign in</Text>
      </Pressable>
    </View>
  );
}

function Hero({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={styles.hero}>
      <ThreadRule style={styles.heroRule} />
      <Text style={styles.eyebrow}>A preventive health companion</Text>
      <Text style={styles.headline}>
        Built to work <Text style={styles.headlineAccent}>before</Text> anything is wrong.
      </Text>
      <Text style={styles.subhead}>
        Swasthya Saathi keeps your medicines, appointments and readings in one place, and reads
        that same record back to you in plain conversation -- so what to watch for is worked out
        from your own history, not a generic checklist.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onSignIn}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Sign in to see your plan</Text>
        <Feather name="arrow-right" size={16} color={colors.cream} />
      </Pressable>
    </View>
  );
}

interface Feature {
  icon: (typeof NAV_SECTIONS)[number]['icon'];
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'message-circle',
    title: 'A chat that actually knows your record',
    body: 'Ask what you took this morning or how a reading has trended, and it answers from your real medicines, appointments and readings -- not a guess.',
  },
  {
    icon: 'shield',
    title: 'Nothing changes without you saying so',
    body: 'Before it writes anything to your record -- a new medicine, a note, a stopped prescription -- it shows you exactly what it wants to do and waits for your go-ahead.',
  },
  {
    icon: 'sun',
    title: 'Today, treatment and prevention together',
    body: "The doses due right now and the screenings worth doing this month, on one screen -- so it's a companion, not a pill reminder.",
  },
  {
    icon: 'trending-up',
    title: 'A plan that can’t go stale',
    body: 'Your preventive checks are worked out fresh from your age, body and history every time you look -- change a reading and the plan changes with it, nothing to fall out of date.',
  },
  {
    icon: 'folder',
    title: 'One place for the whole record',
    body: 'Medicines, appointments, doctors, conditions, symptoms and readings -- kept together, so a question about any of them has an answer.',
  },
  {
    icon: 'user',
    title: 'Built around your own household',
    body: 'A health baseline -- age, body, habits, family history -- decides which screenings actually apply to you, not a one-size list.',
  },
];

function Features({ wide }: { wide: boolean }) {
  return (
    <View style={styles.features}>
      <Text style={styles.sectionTitle}>What&apos;s actually in here</Text>
      <View style={[styles.grid, wide && styles.gridWide]}>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={[styles.tile, wide && styles.tileWide]}>
            <View style={styles.tileIcon}>
              <Feather name={feature.icon} size={18} color={colors.pine} />
            </View>
            <Text style={styles.tileTitle}>{feature.title}</Text>
            <Text style={styles.tileBody}>{feature.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ClosingCta({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={styles.closing}>
      <ThreadRule style={styles.closingRule} />
      <Text style={styles.closingTitle}>Nothing needs you today -- that&apos;s the point.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onSignIn}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Sign in</Text>
        <Feather name="arrow-right" size={16} color={colors.cream} />
      </Pressable>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Swasthya Saathi -- your health companion.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1 },
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: spacing.lg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },
  headerLink: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerLinkText: { ...type.body, fontWeight: '600', color: colors.pine },
  pressed: { opacity: 0.75 },

  hero: { paddingTop: spacing.xxl, paddingBottom: spacing.xl, maxWidth: 640 },
  heroRule: { marginBottom: spacing.md },
  eyebrow: {
    ...type.label,
    color: colors.marigoldText,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  headline: { ...type.display, fontSize: 40, lineHeight: 46, color: colors.ink },
  headlineAccent: { color: colors.pine },
  subhead: {
    ...type.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.taupe,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.pine,
    borderRadius: radii.button,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  primaryButtonText: { ...type.body, fontWeight: '600', color: colors.cream },

  features: { paddingVertical: spacing.xl },
  sectionTitle: {
    ...type.label,
    color: colors.taupe,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  tileWide: { width: '32%', minWidth: 260, flexGrow: 1 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    marginBottom: spacing.md,
  },
  tileTitle: { ...type.title, fontSize: 17, color: colors.ink, marginBottom: spacing.xs },
  tileBody: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.taupe },

  closing: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    marginTop: spacing.md,
  },
  closingRule: { marginBottom: spacing.md },
  closingTitle: {
    ...type.title,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 420,
  },

  footer: { alignItems: 'center', paddingVertical: spacing.xl },
  footerText: { ...type.caption, color: colors.taupe },
});
