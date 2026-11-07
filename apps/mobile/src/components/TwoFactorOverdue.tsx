import type { Membership } from '@soirely/api-client';
import { router } from 'expo-router';
import type { RefObject } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SECTION_HREF } from '../kit/appNav.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { signOutHere } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { cardFrame } from './cardFrame.ts';
import { Screen } from './Screen.tsx';
import { Text, type TextHandle } from './Text.tsx';

/** `PolicySignIn-*` state `everyone_blocked`: in place of every screen of the organisation (sc-609). */
export function TwoFactorOverdue({
  organisation,
  answer,
  headingRef,
}: {
  organisation: Membership;
  /** A tapped switch into the organisation, which takes screen reader focus to the heading (sc-11032). */
  answer: unknown;
  headingRef?: RefObject<TextHandle | null>;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();

  return (
    <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
      <View style={[cardFrame(kind), styles.card, kind !== 'phone' && styles.cardTablet]}>
        <AnswerHeading
          size={tokens.typeTitleDialog.size}
          weight="bold"
          answer={answer}
          ref={headingRef}
        >
          {t('signInRules.overdueTitle')}
        </AnswerHeading>
        <Text size={tokens.typeBodyPhone.size}>
          {t('signInRules.overdueBody', { organisation: organisation.name })}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('signInRules.overdueElsewhere')}
        </Text>
        <View style={[styles.actions, kind !== 'phone' && styles.actionsTablet]}>
          <PrimaryButton
            label={t('signInRules.overdueTurnOn')}
            onPress={() => router.navigate(SECTION_HREF.security)}
            paired
            testID="twoFactorOverdue.turnOn"
          />
          <SecondaryButton
            label={t('signInRules.overdueSignOut')}
            onPress={signOutHere}
            stacked
            paired
            testID="twoFactorOverdue.signOut"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  phone: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: {
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space5xl,
  },
  landscape: {
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space5xl,
  },
  card: {
    padding: tokens.spaceXxl,
    ...(Platform.OS === 'ios'
      ? tokens.elevationNative.card.ios
      : tokens.elevationNative.card.android),
  },
  cardTablet: { maxWidth: 560 },
  actions: { gap: tokens.spaceMd, marginTop: tokens.spaceSm },
  actionsTablet: { maxWidth: 400 },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
