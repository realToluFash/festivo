import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppFrame, FramePaused } from './AppFrame.tsx';
import { SettingsList, useBackToSettings } from './SettingsList.tsx';
import { settingsListBeside, useLayout } from '../layout/useLayout.ts';

type PausedRow = 'organisation' | 'signInRules';

/** On a tablet on its side, the paused page beside the Settings list, where Choose a section or the row's page sits otherwise; the list's column carries the title and the bell (sc-86077). */
export function PausedBesideList({ open }: { open: PausedRow | null }) {
  const { t } = useTranslation();
  const { kind } = useLayout();

  return (
    <AppFrame
      current="settings"
      top="scrolls"
      listUnderTabs
      aboutTheAccount
      title={t('settings.title')}
    >
      <View style={styles.row}>
        <SettingsList kind={kind} open={open} />
        <View style={styles.fill}>
          <FramePaused />
        </View>
      </View>
    </AppFrame>
  );
}

/** A row of the paused organisation's opens its paused page: beside the list on its side, otherwise on its own under ‹ Settings with no page title (sc-86077). */
export function PausedSettingsSection({ open }: { open: PausedRow }) {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();

  if (settingsListBeside(kind)) return <PausedBesideList open={open} />;

  return (
    <AppFrame
      current="settings"
      title={t('settings.title')}
      back={backToSettings(t('settings.title'))}
    >
      {null}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  fill: { flex: 1, minWidth: 0 },
});
