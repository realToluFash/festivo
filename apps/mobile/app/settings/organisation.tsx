import { roleHolds } from '@soirely/domain';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, bodyEdges } from '../../src/components/AppFrame.tsx';
import { EditableDetails, ReadOnlyDetails } from '../../src/components/OrganisationDetails.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { Text } from '../../src/components/Text.tsx';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import { useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Organisation, `AppSettings-*` state `org`: the web's General, for the organisation the switcher is in. */
export default function Organisation() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const phone = kind === 'phone';

  return (
    <AppFrame
      current="settings"
      title={phone ? t('settings.organisation') : t('settings.title')}
      back={phone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="organisation">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!phone && (
            <Text
              size={
                kind === 'tabletLandscape' ? tokens.typeTitlePage.size : tokens.typeTitlePhone.size
              }
              weight="bold"
              accessibilityRole="header"
            >
              {t('settings.organisation')}
            </Text>
          )}
          <Text size={tokens.typeBodyPhone.size} style={styles.intro}>
            {t('orgGeneral.intro')}
          </Text>
          {organisation != null && (
            <View style={styles.cards}>
              {roleHolds(organisation.role, 'organisation.manage') ? (
                <EditableDetails key={organisation.id} organisation={organisation} kind={kind} />
              ) : (
                <ReadOnlyDetails organisation={organisation} kind={kind} />
              )}
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
  intro: { color: tokens.colorInkSecondary, maxWidth: 640 },
  cards: { gap: tokens.spaceLg },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
