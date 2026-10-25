import type { Membership } from '@soirely/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SECTION_HREF } from '../kit/appNav.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { signOutHere } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { Screen } from './Screen.tsx';
import { cardFrame } from './cardFrame.ts';
import { Text } from './Text.tsx';

/** `PolicySignIn-*` state `everyone_blocked`: in place of every screen of the organisation (sc-609). */
export function TwoFactorOverdue({
  organisation,
  answer,
}: {
  organisation: Membership;
  /** A tapped switch into the organisation, which takes screen reader focus to the heading (sc-11032). */
  answer: unknown;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();

  return (
    <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
      <View style={[cardFrame(kind), styles.card]}>
        <AnswerHeading
          size={
            kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitleDialog.size
          }
          weight="bold"
          answer={answer}
        >
          {t('signInRules.overdueTitle')}
        </AnswerHeading>
        <Text size={tokens.typeBodyPhone.size}>
          {t('signInRules.overdueBody', { organisation: organisation.name })}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('signInRules.overdueElsewhere')}
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            label={t('signInRules.overdueTurnOn')}
            onPress={() => router.navigate(SECTION_HREF.security)}
            testID="twoFactorOverdue.turnOn"
          />
          <SecondaryButton
            label={t('signInRules.overdueSignOut')}
            onPress={signOutHere}
            testID="twoFactorOverdue.signOut"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  phone: { paddingTop: tokens.spaceXxl, paddingHorizontal: tokens.spaceXl },
  portrait: { paddingTop: tokens.space3xl, paddingHorizontal: tokens.space4xl },
  landscape: { paddingTop: tokens.space4xl, paddingHorizontal: tokens.space5xl },
  card: { gap: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
