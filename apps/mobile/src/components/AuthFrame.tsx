import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { LanguageChoice } from './LanguageChoice.tsx';
import { useMarkSide } from './markSide.ts';
import { useReadOut } from './ReadOut.tsx';
import { Screen, useFocusOnAnswer } from './Screen.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { Title } from './Title.tsx';

const PORTRAIT_COLUMN_WIDTH = 560;
const LANDSCAPE_COLUMN_WIDTH = 520;

/** The screen's title, sized for the layout; `landscapeOnly` keeps the intro to a landscape tablet. */
export function AuthHeading({
  title,
  intro,
  landscapeOnly = false,
  introLive = false,
  done = false,
  answer,
  introAnswer,
}: {
  title: string;
  intro?: string | undefined;
  landscapeOnly?: boolean;
  /** The intro is a status that changes in place, announced politely (WCAG 2.2 SC 4.1.3). */
  introLive?: boolean;
  done?: boolean;
  /** The tap this step answers: the title takes screen reader focus as it shows, and again with each new answer. */
  answer?: unknown;
  /** The tap the intro answers, where the tap's button went: the intro takes focus in place of being read out (sc-11173). */
  introAnswer?: unknown;
}) {
  const { kind } = useLayout();
  const doneMarkSide = useMarkSide(tokens.sizeHitPhoneHero);
  const { shown, read } = useFocusOnAnswer<TextHandle>(answer);
  const { read: introRead } = useFocusOnAnswer<TextHandle>(introAnswer);
  const size = kind === 'phone' ? tokens.typeTitlePhone.size : tokens.typeTitlePage.size;
  const showIntro = intro != null && (!landscapeOnly || kind === 'tabletLandscape');
  useReadOut(introLive && showIntro && introAnswer === undefined ? intro : null, {
    quietAtMount: true,
  });

  return (
    <>
      {done && (
        <View
          style={[styles.doneMark, doneMarkSide]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            size={tokens.typeTitlePage.size}
            weight="bold"
            style={styles.onAccent}
            accessible={false}
          >
            ✓
          </Text>
        </View>
      )}
      <View ref={shown} style={styles.heading}>
        <Title ref={read} size={size} style={styles.title} accessibilityRole="header">
          {title}
        </Title>
        {showIntro && (
          <Text ref={introRead} size={tokens.typeBodyPhone.size} style={styles.secondary}>
            {intro}
          </Text>
        )}
      </View>
    </>
  );
}

/** Every auth screen at three sizes: phone stacks with no card, a tablet centres one, its languages and `foot` under it. */
export function AuthFrame({
  saying = null,
  back,
  atFoot = false,
  foot,
  children,
}: {
  saying?: ReactNode;
  /** In the brand row's place at every size, such as register's ‹ Sign in. */
  back?: ReactNode;
  /** On a phone, the content sits at the foot: a done state's way on. */
  atFoot?: boolean;
  /** After the languages, last on the page, such as sign-in's New here?. */
  foot?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const column = phone ? undefined : COLUMN[kind];

  // One tree at every size, so rotating or entering split view restyles the form and never remounts it:
  // what was typed, the focus and Show or Hide survive.
  return (
    <Screen style={styles.page} contentStyle={CONTENT[kind]}>
      <View style={[styles.brandRow, column]}>
        {back ?? (
          <Title size={tokens.typeTitleDialog.size} style={styles.brand}>
            {t('app.name')}
          </Title>
        )}
      </View>
      <View style={[CARD[kind], column]}>
        {saying}
        {phone && atFoot && <View style={styles.spacer} />}
        <View style={styles.form}>{children}</View>
      </View>
      <View style={[styles.foot, column]}>
        <LanguageChoice />
        {foot}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: tokens.colorPage },
  phoneContent: {
    flexGrow: 1,
    gap: tokens.spaceXxl,
    paddingTop: tokens.spaceSm,
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.space5xl,
  },
  tabletContent: {
    flexGrow: 1,
    alignItems: 'center',
    gap: tokens.spaceXxl,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space6xl,
  },
  brandRow: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  brand: { letterSpacing: -0.4 },
  heading: { gap: tokens.spaceXs },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  onAccent: { color: tokens.colorInkOnDark },
  doneMark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorAccent,
  },
  spacer: { flex: 1 },
  form: { gap: tokens.spaceXl },
  phoneCard: { flexGrow: 1, gap: tokens.spaceXxl },
  card: {
    gap: tokens.spaceXxl,
    padding: tokens.space5xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
  },
  foot: { gap: tokens.spaceLg },
  portraitColumn: { width: PORTRAIT_COLUMN_WIDTH, maxWidth: '100%' },
  landscapeColumn: { width: LANDSCAPE_COLUMN_WIDTH, maxWidth: '100%' },
});

const CONTENT = {
  phone: styles.phoneContent,
  tabletPortrait: styles.tabletContent,
  tabletLandscape: styles.tabletContent,
} as const;

const CARD: Record<LayoutKind, StyleProp<ViewStyle>> = {
  phone: styles.phoneCard,
  tabletPortrait: styles.card,
  tabletLandscape: styles.card,
};

const COLUMN = {
  tabletPortrait: styles.portraitColumn,
  tabletLandscape: styles.landscapeColumn,
} as const;
