import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { LanguageChoice } from './LanguageChoice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Screen } from './Screen.tsx';
import { Text } from './Text.tsx';

const CARD_WIDTH = 520;
const FORM_COLUMN_WIDTH = 600;

/** The screen's title, sized for the layout; `introBeside` keeps the intro to a landscape tablet's left column. */
export function AuthHeading({
  title,
  intro,
  introBeside = false,
  introLive = false,
  done = false,
}: {
  title: string;
  intro?: string | undefined;
  introBeside?: boolean;
  /** The intro is a status that changes in place, announced politely (WCAG 2.2 SC 4.1.3). */
  introLive?: boolean;
  done?: boolean;
}) {
  const { kind } = useLayout();
  const size = kind === 'phone' ? tokens.typeTitlePhone.size : tokens.typeTitlePage.size;
  const showIntro = intro != null && (!introBeside || kind === 'tabletLandscape');
  useReadOut(introLive && showIntro ? intro : null, { quietAtMount: true });

  return (
    <>
      {done && (
        <View style={styles.doneMark}>
          <Text size={tokens.typeTitlePage.size} weight="bold" style={styles.onAccent}>
            ✓
          </Text>
        </View>
      )}
      <View style={styles.heading}>
        <Text size={size} weight="bold" style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {showIntro && (
          <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {intro}
          </Text>
        )}
      </View>
    </>
  );
}

/** Every auth screen at three sizes: phone stacks with no card, portrait centres one, landscape splits saying from doing. */
export function AuthFrame({
  saying = null,
  phoneTop,
  atFoot = false,
  children,
}: {
  saying?: ReactNode;
  /** In place of the brand row on a phone, such as register's back row. */
  phoneTop?: ReactNode;
  /** On a phone, the content sits at the foot: a done state's way on. */
  atFoot?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();

  const brand = (
    <View style={styles.brandRow}>
      <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
        {t('app.name')}
      </Text>
    </View>
  );

  // One tree at every size, so rotating or entering split view restyles the form and never remounts it:
  // what was typed, the focus and Show or Hide survive. Only the heading moves, beside or above the form.
  const landscape = kind === 'tabletLandscape';
  const phone = kind === 'phone';

  return (
    <Screen style={styles.page} contentStyle={CONTENT[kind]}>
      <View style={landscape ? styles.landscapeLeft : undefined}>
        {phone ? (phoneTop ?? brand) : brand}
        {landscape && <View style={styles.landscapeSaying}>{saying}</View>}
        {landscape && <LanguageChoice />}
      </View>
      <View style={MAIN[kind]}>
        <View style={CARD[kind]}>
          {!landscape && saying}
          {phone && atFoot && <View style={styles.spacer} />}
          <View style={styles.form}>{children}</View>
        </View>
        {!landscape && (
          <View style={phone ? undefined : styles.tabletLanguage}>
            <LanguageChoice />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: tokens.colorPage },
  phoneContent: {
    flexGrow: 1,
    gap: tokens.spaceXl,
    paddingTop: tokens.spaceSm,
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.space5xl,
  },
  portraitContent: { flexGrow: 1, gap: tokens.space3xl, padding: tokens.space6xl },
  landscapeContent: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: tokens.space5xl,
    padding: tokens.space6xl,
  },
  brandRow: { height: tokens.sizeHit, justifyContent: 'center' },
  brand: { letterSpacing: -0.4 },
  heading: { gap: tokens.spaceXs },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  onAccent: { color: tokens.colorInkOnDark },
  doneMark: {
    width: tokens.sizeHitPhoneHero,
    height: tokens.sizeHitPhoneHero,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorAccent,
  },
  spacer: { flex: 1 },
  form: { gap: tokens.spaceXl },
  phoneMain: { flexGrow: 1, gap: tokens.spaceXl },
  phoneCard: { flexGrow: 1, gap: tokens.spaceXl },
  centred: { alignItems: 'center', gap: tokens.space3xl },
  tabletLanguage: { width: CARD_WIDTH, maxWidth: '100%' },
  landscapeLeft: { flex: 1, gap: tokens.space3xl },
  landscapeSaying: { flex: 1, justifyContent: 'center', gap: tokens.spaceXl, maxWidth: 460 },
  landscapeRight: { width: FORM_COLUMN_WIDTH, maxWidth: '50%' },
  card: {
    width: CARD_WIDTH,
    maxWidth: '100%',
    gap: tokens.spaceXl,
    padding: tokens.space4xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
  },
  cardFill: { width: '100%' },
});

const CONTENT = {
  phone: styles.phoneContent,
  tabletPortrait: styles.portraitContent,
  tabletLandscape: styles.landscapeContent,
} as const;

const MAIN = {
  phone: styles.phoneMain,
  tabletPortrait: styles.centred,
  tabletLandscape: styles.landscapeRight,
} as const;

const CARD: Record<LayoutKind, StyleProp<ViewStyle>> = {
  phone: styles.phoneCard,
  tabletPortrait: styles.card,
  tabletLandscape: [styles.card, styles.cardFill],
};
