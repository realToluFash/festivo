import { roleHolds } from '@soirely/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFrame, bodyEdges } from '../../src/components/AppFrame.tsx';
import { api } from '../../src/api.ts';
import { CompanyDomainsCard } from '../../src/components/CompanyDomainsCard.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { EditableDetails, ReadOnlyDetails } from '../../src/components/OrganisationDetails.tsx';
import { OwnershipCard } from '../../src/components/OwnershipCard.tsx';
import { RequestLinkCard } from '../../src/components/RequestLinkCard.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, backToSettings } from '../../src/components/SettingsList.tsx';
import { Text } from '../../src/components/Text.tsx';
import { type LayoutKind, useLayout } from '../../src/layout/useLayout.ts';
import { replaceOrganisation, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Organisation, `AppSettings-*` state `org`: the web's General, for the organisation the switcher is in. */
export default function Organisation() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const phone = kind === 'phone';
  const [refusedIn, setRefusedIn] = useState<string | null>(null);
  const refused = organisation != null && refusedIn === organisation.id;

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
              {refused && (
                <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
                  <Notice
                    tone="broken"
                    mark={tokens.marks.broken.glyph}
                    body={t('orgGeneral.refused')}
                  />
                </View>
              )}
              {roleHolds(organisation, 'organisation.manage') && !refused ? (
                <EditableDetails
                  key={organisation.id}
                  organisation={organisation}
                  kind={kind}
                  onForbidden={() => {
                    setRefusedIn(organisation.id);
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
