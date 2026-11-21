import type { EmailDomainsPage } from '@soirely/api-client';
import { type ReactNode, type RefObject, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useShownLanguage } from '../i18n/index.ts';
import { DATA_AND_CONTROL } from '../kit/appNav.ts';
import { type LayoutKind, settingsListBeside, useLayout } from '../layout/useLayout.ts';
import { useOffline } from '../offline.ts';
import { AppFrame, FrameTop, besideRow } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { PaneWithBack } from './DataParts.tsx';
import { LIST_GAP, SETTINGS_PAGE, titleFoot } from './listFrame.ts';
import { Refreshing } from './Refreshing.tsx';
import { Screen } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { SettingsSplit } from './SettingsList.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { PANE_TITLE, paneTitle } from './topTitle.ts';

export type PageLoad =
  { kind: 'loading' } | { kind: 'loaded'; page: EmailDomainsPage } | { kind: 'failed' };

/** Email domains as the API answers it, read again on Try again, on a language change (its instants are written in it) and back online. */
export function useEmailDomainsPage(
  organisationId: string | undefined,
  title: RefObject<TextHandle | null>,
) {
  const language = useShownLanguage();
  const [load, setLoad] = useState<PageLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const { watch, stale, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setAttempt((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(title.current),
  });

  useEffect(() => {
    if (organisationId == null) return;
    let live = true;

    watch(api.emailDomains(organisationId)).then(
      (page) => live && setLoad({ kind: 'loaded', page }),
      () => live && setLoad((before) => (before.kind === 'loaded' ? before : { kind: 'failed' })),
    );

    return () => {
      live = false;
    };
  }, [organisationId, attempt, language, watch]);

  return {
    load,
    stale,
    refreshing,
    setPage: (page: EmailDomainsPage) => setLoad({ kind: 'loaded', page }),
    retry: () => {
      setLoad({ kind: 'loading' });
      setAttempt((n) => n + 1);
    },
  };
}

/** A Data and control page in Settings: alone with the frame's title and back; on its side beside the list, its back above its title when it is one level down. */
export function DataFrame({
  title,
  back,
  paneBack = null,
  stale,
  refreshing,
  titleRef,
  over,
  children,
}: {
  title: string;
  back: { label: string; onPress: () => void; systemBack?: boolean; pill?: boolean };
  paneBack?: { label: string; onPress: () => void } | null;
  stale: ReturnType<typeof useOffline>['stale'];
  refreshing: boolean;
  titleRef: RefObject<TextHandle | null>;
  over?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const alone = !settingsListBeside(kind);
  const refreshingWords = refreshing ? <Refreshing testID="dataAndControl.refreshing" /> : null;

  return (
    <AppFrame
      current="settings"
      top="scrolls"
      listUnderTabs
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      titleRef={alone ? titleRef : undefined}
      title={alone ? title : t('settings.title')}
      back={alone ? back : undefined}
    >
      <SettingsSplit open={DATA_AND_CONTROL}>
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {alone && <FrameTop style={titleFoot(CONTENT[kind])} />}
          {!alone && paneBack != null && (
            <PaneWithBack title={title} back={paneBack}>
              {children}
            </PaneWithBack>
          )}
          {!alone && paneBack == null && (
            <View style={besideRow.row}>
              <View style={styles.shrink}>
                <Text
                  ref={titleRef}
                  size={PANE_TITLE}
                  weight="bold"
                  style={paneTitle}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
              </View>
              {refreshingWords}
            </View>
          )}
          {(alone || paneBack == null) && children}
        </Screen>
      </SettingsSplit>
      {over}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
});

const CONTENT = {
  phone: { ...SETTINGS_PAGE.phone, gap: LIST_GAP },
  tabletPortrait: { ...SETTINGS_PAGE.tabletPortrait, gap: LIST_GAP },
  tabletLandscape: { ...SETTINGS_PAGE.tabletLandscape, gap: LIST_GAP },
} satisfies Record<LayoutKind, object>;
