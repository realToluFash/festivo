import { primaryEmailAddress } from '@soirely/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useWaitingInvitations } from '../invitations.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import { useLayout } from '../layout/useLayout.ts';
import { signOutHere, switchOrganisation, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { Footnote, QuietButton } from './Buttons.tsx';
import { InvitationRows } from './InvitationRows.tsx';
import { cardFrame } from './cardFrame.ts';
import { Text } from './Text.tsx';

/** `OrgSwitcher-*` Tweak `no_org_invitation`: an account in no organisation, with any invitation waiting for it, as the web's `NoOrganisation`. */
export function NoOrganisation() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account } = useSignedIn();
  const waiting = useWaitingInvitations();
  const email = account == null ? '' : (primaryEmailAddress(account) ?? '');

  return (
    <View style={[cardFrame(kind), styles.card]} testID="noOrganisation">
      <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
        {t('noOrganisation.title')}
      </Text>
      <Text size={tokens.typeBodyPhone.size}>{t('noOrganisation.body')}</Text>
      {waiting.invitations.length > 0 ? (
        <View style={styles.invitations}>
          <Text size={tokens.typeMeta.size} weight="semibold" muted accessibilityRole="header">
            {t('invitations.heading')}
          </Text>
          <InvitationRows waiting={waiting} after={{ open: switchOrganisation }} />
        </View>
      ) : (
        <Text size={tokens.typeBodyPhone.size}>{t('noOrganisation.wayOn', { email })}</Text>
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
  signOut: { alignItems: 'flex-start' },
});
