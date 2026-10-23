import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { Screen } from '../../src/components/Screen.tsx';
import { ChooseSection, SettingsList, SettingsSplit } from '../../src/components/SettingsList.tsx';
import { useLayout } from '../../src/layout/useLayout.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings, `AppSettings-*`: the list on a phone, the list beside "Choose a section" on a tablet. */
export default function Settings() {
  const { t } = useTranslation();
  const { kind } = useLayout();

  return (
    <AppFrame current="settings" title={t('settings.title')}>
      <SettingsSplit open={null}>
        {kind === 'phone' ? (
          <Screen edges={bodyEdges(kind)} contentStyle={styles.phone}>
            <SettingsList kind={kind} open={null} />
          </Screen>
        ) : (
          <ChooseSection />
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
});
