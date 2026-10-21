import type { Membership, PausedOrganisation } from '@soirely/api-client';
import { pausedReasonKey } from '@soirely/domain';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SECTION_HREF } from '../kit/appNav.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { bodyEdges } from './AppFrame.tsx';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { Screen } from './Screen.tsx';
import { cardFrame } from './cardFrame.ts';
import { Text } from './Text.tsx';

/** `AccessPaused-*`: in place of every screen of an organisation the account's access to is paused in (sc-564). */
export function AccessPaused({
  paused,
  other,
  onSwitch,
}: {
  paused: PausedOrganisation;
  other: Membership | null;
  onSwitch: (to: Membership) => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { suspension } = paused;
  const named = { organisation: paused.name, domain: suspension.domain ?? '' };
  const addressGone = suspension.reason === 'address_gone';

  return (
    <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
      <View style={[cardFrame(kind), styles.card]}>
        <Text size={tokens.typeBody.size} weight="bold" muted>
          {t('accessPaused.badge')}
        </Text>
        <Text
          size={
            kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitleDialog.size
          }
          weight="bold"
          accessibilityRole="header"
        >
          {t(pausedReasonKey(suspension.reason), named)}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('accessPaused.since', { when: suspension.since.written })}
        </Text>
        <Text size={tokens.typeBodyPhone.size}>{t('accessPaused.kept', named)}</Text>
        <Text size={tokens.typeBodyPhone.size}>{t('accessPaused.untouched')}</Text>
        {suspension.removesAt != null && (
          <Notice
            tone="attention"
            mark="!"
            body={t('accessPaused.removedBy', { ...named, when: suspension.removesAt.written })}
          />
        )}
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('accessPaused.nextTitle')}
        </Text>
        <Text size={tokens.typeBodyPhone.size}>
          {t(
            addressGone ? 'accessPaused.nextAddressGone' : 'accessPaused.nextNothingNeeded',
            named,
          )}
        </Text>
        <View style={styles.actions}>
          {addressGone && (
            <PrimaryButton
              label={t('accessPaused.accountSettings')}
              onPress={() => router.navigate(SECTION_HREF.account)}
              testID="accessPaused.account"
            />
          )}
          {other != null && (
            <SecondaryButton
              label={t('accessPaused.switch')}
              onPress={() => onSwitch(other)}
              testID="accessPaused.switch"
            />
          )}
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
