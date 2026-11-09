import { type OrganisationMember } from '@soirely/api-client';
import { confirmWith, keptBackBy, roleHolds, roleName } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../../src/api.ts';
import { AppFrame, besideRow } from '../../src/components/AppFrame.tsx';
import { bodyEdges } from '../../src/components/bodyEdges.ts';
import {
  DetailRows,
  DetailsScreen,
  type HeldBack,
  OrganisationCard,
} from '../../src/components/OrganisationDetails.tsx';
import { DomainsSection, RequestsSection } from '../../src/components/OrganisationJoining.tsx';
import { type Candidate, OwnershipSection } from '../../src/components/OrganisationOwnership.tsx';
import { useOrganisationChoices } from '../../src/components/OrganisationPicker.tsx';
import { Refreshing } from '../../src/components/Refreshing.tsx';
import { Screen } from '../../src/components/Screen.tsx';
import { SettingsSplit, useBackToSettings } from '../../src/components/SettingsList.tsx';
import { PageToast } from '../../src/components/Summary.tsx';
import { Text, type TextHandle } from '../../src/components/Text.tsx';
import { moveScreenReaderFocus } from '../../src/components/screenReaderFocus.ts';
import { SECTION_HREF } from '../../src/kit/appNav.ts';
import { type CardSaid, detailsOf, saveOrganisation } from '../../src/kit/organisationSave.ts';
import { type LayoutKind, settingsListBeside, useLayout } from '../../src/layout/useLayout.ts';
import { useOffline } from '../../src/offline.ts';
import { reloadSignedIn, replaceOrganisation, useSignedIn } from '../../src/signedIn.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** Settings > Organisation as its demo draws it (sc-30412): the card, the details, joining, then ownership and leaving. */
export default function Organisation() {
  const { t } = useTranslation();
  const backToSettings = useBackToSettings();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const { account, organisation } = useSignedIn();
  const alone = !settingsListBeside(kind);
  const title = useRef<TextHandle>(null);
  const editRef = useRef<ViewInstance>(null);
  const organisationId = organisation?.id;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [saidFor, setSaidFor] = useState<{ id: string; said: CardSaid } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editVisit, setEditVisit] = useState(0);
  const [toastFor, setToastFor] = useState<{ id: string; words: string } | null>(null);
  const [members, setMembers] = useState<{ id: string; list: OrganisationMember[] } | null>(null);
  const { watch, stale, refreshing } = useOffline({
    loaded: loadedFor != null && loadedFor === organisationId,
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(title.current),
  });
  const owner = organisation?.role.seededAs === 'owner';
  const choices = useOrganisationChoices(
    organisation == null ? EMPTY_DETAILS : detailsOf(organisation),
  );

  // The page draws the signed-in organisation; this read is what the offline band dates.
  useEffect(() => {
    if (organisationId == null) return;
    let live = true;

    rereadOrganisation(organisationId, watch).then(
      () => live && setLoadedFor(organisationId),
      () => {},
    );

    return () => {
      live = false;
    };
  }, [organisationId, refresh, watch]);

  useEffect(() => {
    if (organisationId == null || !owner) return;
    let live = true;

    api.members(organisationId).then(
      (found) => live && setMembers({ id: organisationId, list: found.members }),
      () => live && setMembers(null),
    );

    return () => {
      live = false;
    };
  }, [organisationId, owner]);

  const refreshingWords = refreshing ? <Refreshing testID="organisation.refreshing" /> : null;
  const listed = members != null && members.id === organisationId ? members.list : null;
  const said = saidFor != null && saidFor.id === organisationId ? saidFor.said : null;
  const toast = toastFor != null && toastFor.id === organisationId ? toastFor.words : null;
  const candidates: Candidate[] = (listed ?? [])
    .filter((one) => one.status === 'active' && !one.self)
    .map((one) => ({ id: one.id, name: one.user.name, role: roleName(t, one.role) }));
  const onlyOwner =
    owner &&
    listed != null &&
    !listed.some((one) => !one.self && one.status === 'active' && one.role.seededAs === 'owner');
  const via =
    (account == null ? null : confirmWith(account.hasPassword, account.providers)) ?? 'password';

  const body = (() => {
    if (organisation == null) return null;
    const manages = roleHolds(organisation, 'organisation.manage');
    const rules = keptBackBy(organisation, 'organisation.manage');
    const held: HeldBack | null = manages
      ? null
      : rules.length > 0
        ? { by: 'rules', rules }
        : { by: 'role', role: roleName(t, organisation.role) };
    const details = detailsOf(organisation);
    const managesMembers = roleHolds(organisation, 'members.manage');
    const say = (next: CardSaid) => setSaidFor({ id: organisation.id, said: next });
    const onToast = (words: string) => setToastFor({ id: organisation.id, words });

    return (
      <>
        <OrganisationCard
          details={details}
          said={said}
          held={held}
          pane={kind === 'tabletLandscape'}
          stepRef={editRef}
          onEdit={() => {
            setEditVisit((count) => count + 1);
            setEditing(true);
          }}
          onSecurity={() => router.navigate(SECTION_HREF.security)}
        />
        <DetailRows details={details} choices={choices} />
        {managesMembers && (
          <DomainsSection
            key={`domains-${organisation.id}`}
            organisation={organisation}
            calls={api}
            onToast={onToast}
          />
        )}
        {managesMembers && (
          <RequestsSection
            key={`link-${organisation.id}`}
            organisation={organisation}
            calls={api}
            phone={kind === 'phone'}
            onToast={onToast}
          />
        )}
        <OwnershipSection
          key={`ownership-${organisation.id}`}
          organisation={organisation}
          calls={api}
          owner={owner}
          onlyOwner={onlyOwner}
          candidates={candidates}
          via={via}
          onTransferred={(to) => {
            say({ kind: 'transferred', to });
            void reloadSignedIn();
          }}
          onGone={() => router.replace('/')}
        />
        {(manages || editing) && (
          <DetailsScreen
            key={`details-${organisation.id}-${editVisit}`}
            saved={details}
            choices={choices}
            open={editing}
            opener={editRef}
            onSave={async (values) => {
              const outcome = await saveOrganisation(
                (id, changes) => api.updateOrganisation(id, changes),
                organisation,
                values,
              );
              if (outcome.kind === 'forbidden')
                void rereadOrganisation(organisation.id).catch(() => {});
              if (outcome.kind !== 'saved') return outcome;
              replaceOrganisation(outcome.organisation);

              return { kind: 'saved', details: detailsOf(outcome.organisation) };
            }}
            onClose={() => setEditing(false)}
            onSaved={(_, words) => {
              setEditing(false);
              say({ kind: 'saved', words });
            }}
          />
        )}
      </>
    );
  })();

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
                  size={kind === 'tabletLandscape' ? 28 : 30}
                  weight="bold"
                  accessibilityRole="header"
                >
                  {t('settings.organisation')}
                </Text>
              </View>
              {refreshingWords}
            </View>
          )}
          {body}
        </Screen>
      </SettingsSplit>
      {toast != null && (
        <PageToast
          words={toast}
          onClose={() => setToastFor(null)}
          bottom={insets.bottom + tokens.spaceLg}
        />
      )}
    </AppFrame>
  );
}

const EMPTY_DETAILS = {
  name: '',
  countryCode: '',
  contactAddress: '',
  currency: '',
  timezone: '',
  locale: '',
};

/** The page's load, and the reread after a refusal: the signed-in state catches up so every other screen does too. */
async function rereadOrganisation(
  id: string,
  watch: <T>(load: Promise<T>) => Promise<T> = (load) => load,
): Promise<void> {
  const fresh = (await watch(api.organisations())).find((membership) => membership.id === id);
  if (fresh != null) replaceOrganisation(fresh);
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1, minWidth: 0 },
  phone: {
    gap: 18,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space6xl * 2,
  },
  portrait: {
    gap: 18,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl * 2,
  },
  landscape: {
    gap: 18,
    paddingTop: 26,
    paddingHorizontal: 30,
    paddingBottom: tokens.space6xl * 2,
  },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
