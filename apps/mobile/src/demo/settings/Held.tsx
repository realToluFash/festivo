import type { Membership, PausedOrganisation } from '@soirely/api-client';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';

import { AccessPaused } from '../../components/AccessPaused.tsx';
import { AnswerHeading } from '../../components/AnswerHeading.tsx';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { cardFrame } from '../../components/cardFrame.ts';
import { Text } from '../../components/Text.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { YOU } from './sample.ts';

/** What stands in place of Settings while the organisation holds the account: paused access (sc-564) or two-factor overdue (sc-609). */
export type Held = 'paused' | 'overdue';

export function heldOf(value: string | undefined): Held | null {
  return value === 'paused' || value === 'overdue' ? value : null;
}

const PAUSED: PausedOrganisation = {
  id: 'org-ire-events',
  name: YOU.organisation,
  countryCode: 'NG',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  contactAddress: 'hello@ire.events',
  locale: 'en',
  suspension: {
    reason: 'domain_closed',
    domain: 'ire.events',
    since: { at: '2026-11-02T09:00:00Z', written: 'Monday, Nov 2 at 10:00 WAT' },
    removesAt: { at: '2026-12-02T09:00:00Z', written: 'Wednesday, Dec 2 at 10:00 WAT' },
    onlyOwner: false,
  },
  ownerClaim: null,
};

// AccessPaused reads only how many others there are, to choose between switching and the switcher.
const OTHERS = [
  { id: 'org-casa-lumen', name: 'Casa Lumen Eventos' },
  { id: 'org-harbourlight', name: 'Harbour Light Weddings' },
] as unknown as Membership[];

/** The product's paused screen on sample data; Switch organisation opens the demo's switcher. */
function Paused() {
  const opener = useRef<ViewInstance>(null);
  const org = useOrgOpener(opener, false);

  return (
    <AccessPaused
      paused={PAUSED}
      others={OTHERS}
      onSwitch={() => org.onPress()}
      onChoose={() => org.onPress()}
    />
  );
}

/** Two-factor overdue as the product draws it; Turn on opens Security's setup, Sign out lands on Welcome. */
function Overdue({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const shell = useShell();
  const wide = kind !== 'phone';

  return (
    <ScrollView contentContainerStyle={wide ? styles.contentWide : styles.content}>
      <View style={[cardFrame(kind), styles.card, wide && styles.cardWide]}>
        <AnswerHeading size={tokens.typeTitleDialog.size} weight="bold" answer={null}>
          {t('signInRules.overdueTitle')}
        </AnswerHeading>
        <Text size={tokens.typeBodyPhone.size}>
          {t('signInRules.overdueBody', { organisation: YOU.organisation })}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('signInRules.overdueElsewhere')}
        </Text>
        <View style={[styles.actions, wide && styles.actionsWide]}>
          <PrimaryButton
            label={t('signInRules.overdueTurnOn')}
            onPress={() => shell.openSection('security', 'setup')}
            paired
            testID="twoFactorOverdue.turnOn"
          />
          <SecondaryButton
            label={t('signInRules.overdueSignOut')}
            onPress={onSignOut}
            stacked
            paired
            testID="twoFactorOverdue.signOut"
          />
        </View>
      </View>
    </ScrollView>
  );
}

export function HeldStandIn({ held, onSignOut }: { held: Held; onSignOut: () => void }) {
  return held === 'paused' ? <Paused /> : <Overdue onSignOut={onSignOut} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: tokens.spaceXl, paddingBottom: tokens.space3xl },
  contentWide: { paddingTop: tokens.space3xl, paddingBottom: tokens.space5xl },
  card: {
    padding: tokens.spaceXxl,
    ...(Platform.OS === 'ios'
      ? tokens.elevationNative.card.ios
      : tokens.elevationNative.card.android),
  },
  cardWide: { maxWidth: 560 },
  actions: { gap: tokens.spaceMd, marginTop: tokens.spaceSm },
  actionsWide: { maxWidth: 400 },
});
