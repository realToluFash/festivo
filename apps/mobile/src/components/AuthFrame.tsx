import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LayoutKind } from '../layout/classify.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { LanguageChoice } from './LanguageChoice.tsx';
import { Screen } from './Screen.tsx';
import { Text } from './Text.tsx';

const CARD_WIDTH = 520;
const FORM_COLUMN_WIDTH = 600;

/** The heading's size in the frame: a page title on tablets, a phone title on a phone. */
export function authTitleSize(kind: LayoutKind): number {
  return kind === 'phone' ? tokens.typeTitlePhone.size : tokens.typeTitlePage.size;
}

/** Verify email's arrangement at three sizes: phone stacks, portrait centres a card, landscape splits saying from doing. */
export function AuthFrame({ saying, children }: { saying: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const { kind } = useLayout();

  const brand = (
    <View style={styles.brandRow}>
      <Text size={tokens.typeTitleDialog.size} weight="bold">
        {t('app.name')}
      </Text>
    </View>
  );

  if (kind === 'tabletLandscape') {
    return (
      <Screen style={styles.page} contentStyle={styles.landscapeContent}>
        <View style={styles.landscapeLeft}>
          {brand}
          <View style={styles.landscapeSaying}>{saying}</View>
          <LanguageChoice />
        </View>
        <View style={styles.landscapeRight}>
          <View style={[styles.card, styles.cardFill]}>{children}</View>
        </View>
      </Screen>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <Screen style={styles.page} contentStyle={styles.portraitContent}>
        {brand}
        <View style={styles.centred}>
          <View style={styles.card}>
            {saying}
            {children}
          </View>
          <View style={styles.tabletLanguage}>
            <LanguageChoice />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.page} contentStyle={styles.phoneContent}>
      {brand}
      {saying}
      {children}
      <View style={styles.spacer} />
      <LanguageChoice />
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
  spacer: { flex: 1 },
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
