import { primaryEmailAddress } from '@soirely/api-client';
import { router } from 'expo-router';
import { type RefObject, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useWaitingInvitations } from '../invitations.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import { useLayout } from '../layout/useLayout.ts';
import { signOutHere, useSignedIn } from '../signedIn.ts';
import { switchByTap } from '../tappedSwitch.ts';
import { tokens } from '../theme/tokens.ts';
import { useStartOrganisation } from './AppFrame.tsx';
import { Footnote, PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { InvitationRows } from './InvitationRows.tsx';
import { cardFrame } from './cardFrame.ts';
import { Text, type TextHandle } from './Text.tsx';

/** `OrgSwitcher-*` Tweak `no_org_invitation`: an account in no organisation, with any invitation waiting for it, as the web's `NoOrganisation`. */
export function NoOrganisation({
  titleRef,
}: {
  /** For focus to land on once a notice above closes. */
  titleRef?: RefObject<TextHandle | null> | undefined;
} = {}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account } = useSignedIn();
  const waiting = useWaitingInvitations();
  const startOrganisation = useStartOrganisation();
  const startButton = useRef<View>(null);
  const email = account == null ? '' : (primaryEmailAddress(account) ?? '');
  const listed = waiting.invitations.length > 0;
  const StartButton = listed ? SecondaryButton : PrimaryButton;

  return (
    <View style={[cardFrame(kind), styles.card]} testID="noOrganisation">
      <Text
        ref={titleRef}
        size={tokens.typeTitleDialog.size}
        weight="bold"
        accessibilityRole="header"
      >
        {t('noOrganisation.title')}
      </Text>
      <Text size={tokens.typeBodyPhone.size}>{t('noOrganisation.body')}</Text>
      {listed ? (
        <View style={styles.invitations}>
          <Text size={tokens.typeMeta.size} weight="semibold" muted accessibilityRole="header">
            {t('invitations.heading')}
          </Text>
          <InvitationRows waiting={waiting} after={{ open: switchByTap }} />
        </View>
      ) : (
        <Text size={tokens.typeBodyPhone.size}>{t('noOrganisation.wayOn', { email })}</Text>
      )}
      {startOrganisation != null && (
        <View style={styles.start}>
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {t('noOrganisation.startTitle')}
          </Text>
          <Text size={tokens.typeBodyPhone.size}>{t('noOrganisation.startBody')}</Text>
          <View style={styles.startAction}>
            <StartButton
              label={t('noOrganisation.start')}
              onPress={() => startOrganisation(startButton)}
              ref={startButton}
              testID="noOrganisation.start"
            />
          </View>
        </View>
      )}
      <View>
        <Footnote
          question={t('noOrganisation.signedInAs', { email })}
          action={t('noOrganisation.account')}
          onPress={() => router.navigate(SECTION_HREF.account)}
          testID="noOrganisation.account"
        />
        <View style={styles.signOut}>
          <QuietButton
            label={t('settings.signOut')}
            onPress={signOutHere}
            testID="noOrganisation.signOut"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  invitations: { gap: tokens.spaceSm },
  start: {
    gap: tokens.spaceSm,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  startAction: { alignItems: 'flex-start' },
  signOut: { alignItems: 'flex-start' },
});
