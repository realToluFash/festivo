import type { Membership } from '@soirely/api-client';
import { formatDay } from '@soirely/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLocale } from '../i18n/index.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import { rulesNotices } from '../kit/signInRules.ts';
import { markRulesSeen, useRulesSeen } from '../signInRulesSeen.ts';
import { useTwoFactorStanding } from '../twoFactorStanding.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';

/** What the organisation's sign-in rules ask of this member (sc-69, sc-609), `PolicySignIn-*`, each naming the organisation. */
export function SignInRulesNotices({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const [putOff, setPutOff] = useState(false);
  const seen = useRulesSeen(organisation.id);
  const name = organisation.name;
  const notices = rulesNotices(organisation, seen, putOff, useTwoFactorStanding(organisation));
  const changedAt = organisation.signInRules.changedAt;

  if (notices.length === 0) return null;

  return (
    <View style={styles.stack}>
      {notices.includes('due') && organisation.twoFactorDue != null && (
        <Notice
          tone="attention"
          mark="!"
          body={t('signInRules.dueBody', {
            organisation: name,
            deadline: organisation.twoFactorDue.written,
          })}
          action={{
            label: t('signInRules.dueSetUp'),
            onPress: () => router.navigate(SECTION_HREF.security),
            testID: 'signInRules.dueSetUp',
          }}
        />
      )}

      {notices.includes('readOnly') && (
        <Notice
          tone="attention"
          mark="!"
          title={t('signInRules.unlinkedTitle')}
          body={t('signInRules.unlinkedBody', { organisation: name })}
          action={{
            label: t('signInRules.unlinkedLink'),
            onPress: () => router.navigate(SECTION_HREF.security),
            testID: 'signInRules.link',
          }}
        />
      )}

      {notices.includes('twoFactor') && (
        <View style={styles.group}>
          <Notice
            tone="quiet"
            mark={tokens.marks.info.glyph}
            title={t('signInRules.gateTitle', { organisation: name })}
            body={t('signInRules.gateBody', { organisation: name })}
            action={{
              label: t('signInRules.gateTurnOn'),
              onPress: () => router.navigate(SECTION_HREF.security),
              testID: 'signInRules.turnOn',
            }}
          />
          <QuietButton
            label={t('signInRules.gateLater')}
            onPress={() => setPutOff(true)}
            testID="signInRules.later"
          />
        </View>
      )}

      {notices.includes('changed') && changedAt != null && (
        <View style={styles.group}>
          <Notice
            tone="quiet"
            mark={tokens.marks.info.glyph}
            title={t('signInRules.changedTitle')}
            body={t('signInRules.changedBody', {
              organisation: name,
              day: formatDay(changedAt, currentLocale()),
            })}
            action={{
              label: t('signInRules.changedSee'),
              onPress: () => router.navigate(SECTION_HREF.signInRules),
              testID: 'signInRules.see',
            }}
          />
          <QuietButton
            label={t('signInRules.changedClose')}
            onPress={() => markRulesSeen(organisation)}
            testID="signInRules.close"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceLg },
  group: { gap: tokens.spaceXs },
});
