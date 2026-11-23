import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, FrameTop } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { Screen } from '../../src/components/Screen.tsx';
import { PausedBesideList } from '../../src/components/PausedSettings.tsx';
import { ChooseASection } from '../../src/components/SettingsHome.tsx';
import { SettingsList, SettingsSplit } from '../../src/components/SettingsList.tsx';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings as its demo draws it (sc-30412): the list on its own screen on a phone and an upright tablet, the list beside "Choose a section" on a tablet on its side. While paused the list stays Settings' home, the paused page beside it on its side (sc-86077). */
export default function Settings() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { pausedIn } = useSignedIn();

  if (pausedIn != null && settingsListBeside(kind)) return <PausedBesideList open={null} />;

  return (
    <AppFrame
      current="settings"
      top="scrolls"
      listUnderTabs
      aboutTheAccount={pausedIn != null}
      switchedAt={styles.switched}
      title={t('settings.title')}
    >
      <SettingsSplit open={null}>
        {settingsListBeside(kind) ? (
          <ChooseASection />
        ) : (
          <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
            <FrameTop
              style={kind === 'tabletPortrait' && styles.portraitTop}
              rowStyle={kind === 'phone' ? styles.phoneTitle : styles.portraitTitle}
            />
            <SettingsList kind={kind} open={null} />
          </Screen>
        )}
      </SettingsSplit>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  phone: {
    gap: 0,
    paddingTop: tokens.spaceXs,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space6xl,
  },
  portrait: {
    gap: 0,
    paddingTop: 0,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  phoneTitle: { minHeight: 0, paddingTop: tokens.spaceXs, paddingBottom: 18 },
  portraitTop: { paddingTop: 30 },
  portraitTitle: { minHeight: 0, paddingBottom: 22, paddingHorizontal: tokens.spaceHair },
  switched: { marginBottom: tokens.spaceXl },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.portrait,
};
