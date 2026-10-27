import { primaryEmailAddress } from '@soirely/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { DevicesCard } from '../../src/components/DevicesCard.tsx';
import { PasswordCard } from '../../src/components/PasswordCard.tsx';
import { Screen, type StepClosed, stepClosed } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { Text } from '../../src/components/Text.tsx';
import { TwoFactorCard } from '../../src/components/TwoFactorCard.tsx';
import { WaysCard } from '../../src/components/WaysCard.tsx';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import {
  endedHere,
  reloadSignedIn,
  rereadAccount,
  signOutHere,
  useSignedIn,
} from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Security, `AppSettings-*` state `security`: every card the interim screen held. */
export default function Security() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisations } = useSignedIn();
  const [settingPassword, setSettingPassword] = useState(false);
  const [setFrom, setSetFrom] = useState('setPassword');
  const [setClosed, setSetClosed] = useState<StepClosed | undefined>(undefined);
  const [sessionsEnded, setSessionsEnded] = useState(0);
  const [codesSpent, setCodesSpent] = useState(0);
  const codeSpent = () => setCodesSpent((n) => n + 1);

  const phone = kind === 'phone';
  const email = account == null ? '' : (primaryEmailAddress(account) ?? '');

  return (
    <AppFrame
      current="settings"
      aboutTheAccount
      title={phone ? t('security.title') : t('settings.title')}
      back={phone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="security">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!phone && (
            <Text
              size={
                kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size
              }
              weight="bold"
              accessibilityRole="header"
            >
              {t('security.title')}
            </Text>
          )}
          {account != null && (
            <View style={styles.cards}>
              <PasswordCard
                email={email}
                hasPassword={account.hasPassword}
                providers={account.providers}
                kind={kind}
                onAdded={reloadSignedIn}
                setting={settingPassword}
                onSetting={setSettingPassword}
                onSetCancelled={() => setSetClosed(stepClosed(setFrom))}
                onChanged={() => setSessionsEnded((n) => n + 1)}
              />
              <WaysCard
                email={email}
                hasPassword={account.hasPassword}
                providers={account.providers}
                kind={kind}
                onChanged={async () => {
                  await reloadSignedIn();
                  setSessionsEnded((n) => n + 1);
                }}
                onRefused={rereadAccount}
                onSetPassword={(from) => {
                  setSetFrom(from);
                  setSettingPassword(true);
                }}
                setPasswordClosed={setClosed}
                onSignedOutHere={signOutHere}
                onCodeSpent={codeSpent}
              />
              <TwoFactorCard
                email={email}
                kind={kind}
                recount={codesSpent}
                keptBy={
                  organisations.find((one) => one.signInRules.everyoneNeedsTwoFactor)?.name ?? null
                }
                onTurnedOn={() => void reloadSignedIn()}
              />
              <DevicesCard
                hasPassword={account.hasPassword}
                providers={account.providers}
                kind={kind}
                reload={sessionsEnded}
                onSignOutHere={signOutHere}
                onEndedHere={endedHere}
                onCodeSpent={codeSpent}
              />
            </View>
          )}
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: { gap: tokens.spaceXl, padding: tokens.space3xl, paddingBottom: tokens.space6xl },
  landscape: {
    gap: tokens.spaceXxl,
    paddingTop: tokens.space4xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  cards: { gap: tokens.spaceLg },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
