import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { Screen } from '../../src/components/Screen.tsx';
import { ChooseSection, SettingsList, SettingsSplit } from '../../src/components/SettingsList.tsx';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings, `AppSettings-*`: the list on its own screen on a phone and an upright tablet, the list beside "Choose a section" on a tablet on its side. */
export default function Settings() {
  const { t } = useTranslation();
  const { kind } = useLayout();

  return (
    <AppFrame current="settings" title={t('settings.title')}>
      <SettingsSplit open={null}>
        {settingsListBeside(kind) ? (
          <ChooseSection />
        ) : (
          <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
            <SettingsList kind={kind} open={null} />
          </Screen>
        )}
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  phone: {
    paddingTop: tokens.spaceXxl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: { padding: tokens.space3xl, paddingBottom: tokens.space6xl },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.portrait,
};
