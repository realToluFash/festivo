import { type Membership } from '@soirely/api-client';
import { roleHolds } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, besideRow } from '../../src/components/AppFrame.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import { api } from '../../src/api.ts';
import { CompanyDomainsCard } from '../../src/components/CompanyDomainsCard.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { EditableDetails, ReadOnlyDetails } from '../../src/components/OrganisationDetails.tsx';
import { OwnershipCard } from '../../src/components/OwnershipCard.tsx';
import { RequestLinkCard } from '../../src/components/RequestLinkCard.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { useOffline } from '../../src/offline.ts';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { replaceOrganisation, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Organisation, `AppSettings-*` state `org`: the web's General, for the organisation the switcher is in. */
export default function Organisation() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const alone = !settingsListBeside(kind);
  const [refusedIn, setRefusedIn] = useState<{ from: Membership; byRule: boolean } | null>(null);
  // Until the reread lands the refused membership stands; after it, only a fresh one still without the permission does.
  const refused =
    organisation != null &&
    refusedIn?.from.id === organisation.id &&
    (refusedIn.from === organisation || !roleHolds(organisation, 'organisation.manage'));
  const notAllowed = t(
    refusedIn?.byRule === true ? 'orgGeneral.refusedByRule' : 'orgGeneral.refused',
  );
  const title = useRef<TextHandle>(null);
  const organisationId = organisation?.id;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { watch, stale, refreshing } = useOffline({
    loaded: loadedFor != null && loadedFor === organisationId,
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(title.current),
  });

  // The page draws the signed-in organisation; this read is what the offline band dates.
  useEffect(() => {
    if (organisationId == null) return;
    let live = true;

    watch(api.organisations()).then(
      (all) => {
        if (!live) return;
        const fresh = all.find((membership) => membership.id === organisationId);
        if (fresh != null) replaceOrganisation(fresh);
        setLoadedFor(organisationId);
      },
      () => {},
    );

    return () => {
      live = false;
    };
  }, [organisationId, refresh, watch]);

  const refreshingWords = refreshing ? <Refreshing testID="organisation.refreshing" /> : null;

  return (
    <AppFrame
      current="settings"
      offline={stale}
      besideTitle={alone ? refreshingWords : undefined}
      titleRef={alone ? title : undefined}
      title={alone ? t('settings.organisation') : t('settings.title')}
      back={alone ? backToSettings(t('settings.title')) : undefined}
    >
      <SettingsSplit open="organisation">
        <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
          {!alone && (
            <View style={besideRow.row}>
              <View style={styles.shrink}>
                <Text
                  ref={title}
                  size={tokens.typeTitlePage.size}
                  weight="bold"
                  accessibilityRole="header"
                >
                  {t('settings.organisation')}
                </Text>
              </View>
              {refreshingWords}
            </View>
          )}
          <Text size={tokens.typeBodyPhone.size} style={styles.intro}>
            {t('orgGeneral.intro')}
          </Text>
          {organisation != null && (
            <View style={styles.cards}>
              {refused && (
                <Notice
                  tone="broken"
                  mark={tokens.marks.broken.glyph}
                  body={notAllowed}
                  answer={refusedIn}
                  takesFocus
                />
              )}
              {roleHolds(organisation, 'organisation.manage') && !refused ? (
                <EditableDetails
                  key={organisation.id}
                  organisation={organisation}
                  kind={kind}
                  onForbidden={(byRule) => {
                    setRefusedIn({ from: organisation, byRule });
                    void rereadOrganisation(organisation.id);
                  }}
                />
              ) : (
                <ReadOnlyDetails organisation={organisation} kind={kind} />
              )}
              {roleHolds(organisation, 'members.manage') && (
                <CompanyDomainsCard
                  key={`domains-${organisation.id}`}
                  organisation={organisation}
                  kind={kind}
                />
              )}
              {roleHolds(organisation, 'members.manage') && (
                <RequestLinkCard
                  key={`request-link-${organisation.id}`}
                  organisation={organisation}
                  kind={kind}
                />
              )}
              <OwnershipCard
                key={`ownership-${organisation.id}`}
                organisation={organisation}
                kind={kind}
              />
            </View>
          )}
        </Screen>
      </SettingsSplit>
    </AppFrame>
  );
}

/** The role changed under the page; the signed-in state catches up so every other screen does too. */
async function rereadOrganisation(id: string): Promise<void> {
  try {
    const fresh = (await api.organisations()).find((membership) => membership.id === id);
    if (fresh != null) replaceOrganisation(fresh);
  } catch {
    // The refusal is already on screen; a failed reread leaves the rest of the page as it was.
  }
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
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
