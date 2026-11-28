import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Brand } from './Brand.tsx';
import { DraftTile } from './DraftTile.tsx';
import { Pill } from './SettingsParts.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text, type TextHandle } from './Text.tsx';

const COLUMN = 560;

/** You are not in an organisation, alone: the logo at the top, the title and why, then `children`, in one column with no card and no tab bar (sc-75471). */
export function NoOrgPage({
  titleRef,
  notices,
  children,
}: {
  titleRef?: RefObject<TextHandle | null> | undefined;
  /** What the product says above the title, as a sign-in it just linked. */
  notices?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const phone = kind === 'phone';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (phone ? tokens.spaceXxl : 60),
          paddingBottom: insets.bottom + tokens.space3xl,
        },
      ]}
      testID="noOrganisation"
    >
      {!phone && (
        <View style={styles.corner}>
          <Brand lockup height={24} />
        </View>
      )}
      <View style={[styles.column, !phone && styles.columnWide]}>
        {phone && <Brand lockup height={24} />}
        {notices}
        <Text
          ref={titleRef}
          size={28}
          weight="bold"
          accessibilityRole="header"
          style={styles.title}
        >
          {t('noOrganisation.title')}
        </Text>
        <Text size={16} weight="medium" style={styles.body}>
          {t('noOrganisation.body')}
        </Text>
        {children}
      </View>
    </ScrollView>
  );
}

/** The line that says how to get back in, when no invitation is waiting. */
export function NoOrgWayOn({ email }: { email: string }) {
  const { t } = useTranslation();

  return (
    <Text size={16} weight="medium" muted style={styles.body}>
      {t('noOrganisation.wayOn', { email })}
    </Text>
  );
}

/** Start your own, on its tint: the draft tile, what it does, and Start organisation. */
export function StartYourOwn({
  startRef,
  onStart,
}: {
  startRef: RefObject<ViewInstance | null>;
  onStart: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.own}>
      <DraftTile name="" side={48} radius={16} initials={18} />
      <View style={styles.ownWords}>
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.ownTitle}>
          {t('noOrganisation.startTitle')}
        </Text>
        <Text size={15} weight="medium" muted style={styles.small}>
          {t('noOrganisation.startBody')}
        </Text>
      </View>
      <Pill
        ref={startRef}
        label={t('noOrganisation.start')}
        onPress={onStart}
        testID="noOrganisation.start"
      />
    </View>
  );
}

/** Who is signed in, with Your account and Sign out side by side. */
export function SignedInWays({
  email,
  onAccount,
  onSignOut,
}: {
  email: string;
  onAccount: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.signedIn}>
      <Text size={14} weight="medium" muted style={styles.small}>
        {t('noOrganisation.signedInAs', { email })}
      </Text>
      <View style={styles.ways}>
        <TextAction
          label={t('noOrganisation.account')}
          onPress={onAccount}
          testID="noOrganisation.account"
        />
        <TextAction
          label={t('settings.signOut')}
          onPress={onSignOut}
          testID="noOrganisation.signOut"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: tokens.spaceXxl },
  column: { alignSelf: 'stretch', maxWidth: '100%', gap: tokens.spaceXl },
  columnWide: { alignSelf: 'center', width: COLUMN },
  corner: { alignSelf: 'flex-start', marginBottom: tokens.space3xl },
  title: { lineHeight: 28 * 1.15, letterSpacing: 28 * -0.02, marginTop: tokens.spaceSm },
  body: { lineHeight: 16 * 1.45 },
  own: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXxl,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorAccentTint,
  },
  ownWords: { gap: tokens.spaceXs },
  ownTitle: { lineHeight: 20 * 1.25 },
  small: { lineHeight: 15 * 1.4 },
  signedIn: { gap: tokens.spaceXxs },
  ways: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
});
