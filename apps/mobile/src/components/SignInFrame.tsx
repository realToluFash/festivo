import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { LanguageChoice } from './LanguageChoice.tsx';
import { Screen } from './Screen.tsx';
import { Text } from './Text.tsx';

const CARD_WIDTH = 520;
const FORM_COLUMN_WIDTH = 600;

/** Untitled, it frames a signed-in state that must not read as a sign-in screen. */
export function SignInFrame({
  title,
  intro,
  children,
}: {
  title?: string | undefined;
  /** Said beside the title on a landscape tablet, where the left column has room. */
  intro?: string | undefined;
  children: ReactNode;
}) {
  const { kind } = useLayout();

  if (kind === 'tabletLandscape') {
    return (
      <Landscape title={title} intro={intro}>
        {children}
      </Landscape>
    );
  }

  if (kind === 'tabletPortrait') {
    return <Portrait title={title}>{children}</Portrait>;
  }

  return <Phone title={title}>{children}</Phone>;
}

function Phone({ title, children }: { title?: string | undefined; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.phoneContent}>
      <View style={styles.brandRow}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
          {t('app.name')}
        </Text>
      </View>
      {title != null && (
        <Text size={tokens.typeTitlePhone.size} weight="bold" style={styles.title}>
          {title}
        </Text>
      )}
      {children}
      <View style={styles.spacer} />
      <LanguageChoice />
    </Screen>
  );
}

function Portrait({ title, children }: { title?: string | undefined; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.portraitContent}>
      <View style={styles.brandRow}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
          {t('app.name')}
        </Text>
      </View>
      <View style={styles.centred}>
        <View style={styles.card}>
          {title != null && (
            <Text size={tokens.typeTitlePage.size} weight="bold" style={styles.title}>
              {title}
            </Text>
          )}
          {children}
        </View>
        <View style={styles.tabletLanguage}>
          <LanguageChoice />
        </View>
      </View>
    </Screen>
  );
}

function Landscape({
  title,
  intro,
  children,
}: {
  title?: string | undefined;
  intro?: string | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Screen style={styles.page} contentStyle={styles.landscapeContent}>
      <View style={styles.landscapeLeft}>
        <View style={styles.brandRow}>
          <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
            {t('app.name')}
          </Text>
        </View>
        <View style={styles.landscapeSaying}>
          {title != null && (
            <Text size={tokens.typeTitlePage.size} weight="bold" style={styles.title}>
              {title}
            </Text>
          )}
          {intro != null && (
            <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
              {intro}
            </Text>
          )}
        </View>
        <LanguageChoice />
      </View>
      <View style={styles.landscapeRight}>
        <View style={[styles.card, styles.cardFill]}>{children}</View>
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
  portraitContent: {
    flexGrow: 1,
    gap: tokens.space3xl,
    padding: tokens.space6xl,
  },
  landscapeContent: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: tokens.space5xl,
    padding: tokens.space6xl,
  },

  brandRow: { height: tokens.sizeHit, justifyContent: 'center' },
  brand: { letterSpacing: -0.4 },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  spacer: { flex: 1 },

  centred: { alignItems: 'center', gap: tokens.space3xl },
  tabletLanguage: { width: CARD_WIDTH, maxWidth: '100%' },

  landscapeLeft: { flex: 1, gap: tokens.space3xl },
  landscapeSaying: { flex: 1, justifyContent: 'center', gap: tokens.spaceLg, maxWidth: 460 },
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
